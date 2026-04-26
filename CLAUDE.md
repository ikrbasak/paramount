# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working with this repo.

> **Maintenance note for Claude**: keep file up to date. After architectural changes, non-obvious patterns, or work future instances benefit from, update accordingly.

## Commands

```sh
# Development
bun run dev                # watch mode dev server

# Build
bun run build              # prebuild (tsc) + bundle (bun)

# Code quality (run all after changes)
bun run fmt                # format with oxfmt
bun run lint               # lint with oxlint --fix
bun run build              # verify TypeScript compiles

# Testing
bun run test                                        # all tests
bun run test -- tests/path/to/file.ts              # single test file
bun run test:cov                                    # with coverage

# Database & Seeders (via Makefile)
make migration:generate    # generate migration from schema changes
make migration:run         # apply pending migrations
make seeder:run            # run pending seeders
```

## Workflow rules

- **After every file change**: run `bun run fmt`, `bun run lint`, and `bun run build` before work done.
- **Imports**: use absolute imports via path aliases (`@/`, `~/`, `#/`) — no relative paths.
- **Runtime**: Bun only. Never use `npm`, `pnpm`, or `yarn`.
- **Dependencies**: prefer Bun built-ins (`Bun.serve`, `Bun.password`, etc.) before packages. If package needed, explain in 2–3 sentences and ask confirmation before adding.
- **CI/CD**: uses GitHub Actions (`.github/workflows/`). Pin `uses` actions to exact commit SHAs with version comments (e.g. `uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1`). **Before modifying any workflow**, read `docs/workflows.md` for full context on branch strategy, triggers, labels, and setup requirements. **After modifying workflows**, update `docs/workflows.md` to reflect the changes.
- **Transactions**: when writing to both DB and cache (Redis), wrap DB ops in MikroORM transaction, apply cache mutations only after DB commit.
- **TypeScript types**: prefer `type` over `interface` unless declaration merging is needed.
- **Zod imports**: use `import * as z from 'zod'` — never default import (`import z from 'zod'`).
- **Environment variables**: never read `.env*` files directly. Refer to `src/validators/schemas/environment.ts` for available env vars and their types.
- **Bundling**: Bun native bundler — no alternative bundler config or deps.
- **Datetime precision**: use precision 3 for datetime columns in MikroORM entities (e.g. `p.datetime(3)`) — matches `BaseUuidEntity` in `src/database/helpers/index.ts`.

## Architecture

**Paramount** — Hono + Bun backend with PostgreSQL (MikroORM), Redis (ioredis), BullMQ.

### Request lifecycle

`src/index.ts` → `src/server.ts` (middleware stack, error handler) → `src/routes/` (handlers) → `src/services/` (business logic) → database/cache/queues

Middleware chain (order): logger → CORS → timing debugger → body limit → timeout → routes → global error handler.

### Layered structure

All features follow **router → service → repository** pattern:

- **Routes** (`src/routes/`) — validate input with Zod via `requestValidate`, call service, return response. No business logic.
- **Services** (`src/services/`) — orchestrate business logic, call repositories.
- **Repositories** — thin wrappers around MikroORM entity managers; all ORM ops run inside context from `withOrmContext`.

### Key libraries in `src/lib/`

- **`error/`** — Custom error hierarchy (`CustomError`, `CustomZodError`) with typed status codes. All errors caught at server level, formatted as JSON.
- **`logger/`** — Pino logger with `AsyncLocalStorage` for per-request `correlationId` tracing. Wrap async work in `withLogContext` for log context propagation.
- **`queue/`** — Abstract `BaseQueue` and `BaseWorker` classes (BullMQ), auto-inject ORM context + logger per job. New job types added to `src/lib/queue/types.ts` (`JobRegistry`) — maps job name to payload type. See [Queues](#queues) for rules.
- **`hono/`** — `requestValidate` wrapper for Zod request validation (body, query, params).

### Config & validation

Env vars validated via Zod schemas in `src/validators/schemas/`. Configs split by domain: `src/configs/{database,queue,redis,env}.ts`. Use domain config object, not `process.env` directly.

### Database

Entities in `src/database/entities/`, must be added to `entities` array in `src/configs/database.ts`. MikroORM uses `UnderscoreNamingStrategy` (camelCase → snake_case). `SoftDeleteSubscriber` globally registered. `ignoreUndefinedInQuery: true` — `undefined` in query omits condition. Migrations in `src/database/migrations/`, seeders in `src/database/seeders/`. `mikro-orm.config.ts` at root for CLI. DB commands in `Makefile`.

`withOrmContext` applied globally in `server.ts` for all HTTP requests — routes/services don't call it manually. Required outside requests (scripts, queue jobs — `BaseWorker` handles automatically).

### Queues

BullMQ queues/workers in `src/lib/queue/`. Rules:

- **Dispatch via `queue.dispatch(data, opts?)`** — never call `queue.add(...)` directly. `dispatch` typed wrapper ensures correct job name + payload from `JobRegistry`.
- **Workers don't auto-start.** `defaultWorkerOptions` sets `autorun: false` (`src/configs/queue.ts`), must be resumed at startup. Resumed in `initialize()` in `src/index.ts`; cleanup is registered as a disposer (see [Lifecycle](#lifecycle--shutdown)) — new workers must be registered in `src/queues/`.
- **New job types** added to `JobRegistry` in `src/lib/queue/types.ts`. **Job names use PascalCase** (e.g. `EmailSend`).
- `BaseWorker` already attaches `failed`/`error`/`stalled` listeners — don't re-wire them per worker.

### Redis

`src/configs/redis.ts` exports two named option objects — pick the right one when creating a new client; never spread-override a single shared config:

- **`bullmqRedisOptions`** — for BullMQ queues/workers. **Must** keep `maxRetriesPerRequest: null` (ioredis disables blocking commands like `BRPOP` otherwise).
- **`cacheRedisOptions`** — for short request/response commands (cache, rate limit, etc.). Caps `maxRetriesPerRequest` so a slow/unreachable Redis fails fast instead of hanging the request.

The shared cache client (`src/cache/client.ts`) already logs `error`/`reconnecting`/`end` events — new clients should do the same.

### Lifecycle / shutdown

`src/index.ts` uses a **disposer stack**: each long-lived resource pushes a cleanup function as it comes up; shutdown drains them in reverse (LIFO).

- Signal + crash handlers (`SIGINT`/`SIGTERM`/`SIGHUP`/`uncaughtException`/`unhandledRejection`) are registered **before** `initialize()`, so a failure during init still triggers ordered cleanup of whatever did start.
- When adding a new long-lived resource (extra DB pool, external client, metrics exporter, etc.), push its cleanup into `disposers` next to where it's created — don't add ad-hoc branches inside `shutdown`.
- Disposer errors are logged and tracked but do not abort the chain — every disposer runs once, then the process exits with the appropriate code.

### Error handling

Throw `CustomError` (or subclass) for domain errors; `CustomZodError` for validation errors. Both accept `cause` object. All errors caught by server, normalized via `ErrorFormat.format()` into `{ status, message, cause?, stack? }`.

Extend `CustomError` when dedicated type adds clarity:

```ts
export class ForbiddenError extends CustomError {
  constructor(msg: string, cause: ErrorContext = {}) {
    super(HttpStatus.Forbidden, msg, cause);
  }
}
```

Pre-built: `NotFoundError`. Add others (`UnprocessableEntityError`, `ForbiddenError`, `ConflictError`) as needed.

### Constants

Centralized in `src/constants/`:

- **`APIRoute`** — route path strings (`satisfies Record<string, string>`). **`APIRouteVersion`** — version prefixes (e.g. `/api/v1`). Never hardcode paths in handlers.
- **`ErrorMessage.Generic.*`** — static strings. **`ErrorMessage.Field.*`** — parameterized factories (e.g. `ErrorMessage.Field.LabelNotFound('User')`). Never hardcode messages inline.
- **`HttpStatus`** — HTTP status code enum.
- When defining time values, use named constants — no magic numbers.

### Logging

Typed logger built on Pino (`messageKey: 'key'`). Two methods — keys and data shapes enforced via registries in `src/lib/logger/types.ts`:

| Method   | Signature                          | When                                                             |
| -------- | ---------------------------------- | ---------------------------------------------------------------- |
| `.log`   | `log(level, key, data?, options?)` | Inside ALS: accumulates into wide event. Outside: immediate emit |
| `.audit` | `audit(key, data?)`                | Business/compliance events, always info level with `audit: true` |

```ts
logger.log('error', 'redis:cache:error', { error });
logger.log('info', 'hono:req:context', { reqId, url, method });
logger.log('warn', 'bull:job:failed', { error, remaining }, { immediate: true });
logger.audit('user:login', { userId, ip });
```

**`{ immediate: true }`** — inside ALS, adds to wide event AND emits immediately. Useful for errors that need both wide event context and instant visibility.

**Registries** (`src/lib/logger/types.ts`): `LogRegistry` for `.log`. `AuditRegistry` is a superset of `LogRegistry` — all `.log` keys are valid `.audit` keys too. New keys must be added to the registry first — wrong key or wrong data shape = compile error.

**Wide events**: `withLogContext` wraps request/job scope. Each `.log()` call inside ALS stores a discrete event with `key`, `level`, data, and `time`. At scope exit, flushed as single JSON line (`wide:event` key) with `events[]` array. Error exit flushes at `error` level. Outside ALS, `.log()` emits immediately.

**Timestamp field**: Pino outputs `ts` (not `time`) via custom timestamp function. Wide event entries use `time` (ms epoch).

**Keys**: short, colon-namespaced, grep-friendly — not sentences (e.g. `'bull:job:started'`, `'hono:req:failed'`).

Logger auto-redacts `password`, `secret`, `token` — new sensitive fields need redact list update in `src/lib/logger/index.ts`.

### Path aliases

| Alias | Resolves to |
| ----- | ----------- |
| `@/*` | `src/*`     |
| `~/`  | `tests/*`   |
| `#/`  | root        |

### Testing conventions

- Unit: `tests/unit/`, integration: `tests/integration/`
- Global setup (`tests/setup/test.global.setup.ts`) drops/recreates schema, runs migrations + seeders
- Per-file setup (`tests/setup/test.setup.ts`) flushes Redis once before all tests in each file (`beforeAll`)
- `tests/utils/request.ts` — typed HTTP helper for integration tests
- Vitest: `bail: 1`, `shuffle: { files: true }`, requires min one assertion per test
- Explicitly import test globals (`describe`, `it`, `expect`, `beforeEach`, etc.) from `vitest` — no auto-injection
- One top-level `describe` per file; nest additional inside
- Write/update tests for new/changed features. Cover happy paths, edge cases, error paths, boundary conditions.
- **Minimize mocking**: only mock what can't run in test env (external third-party APIs). Real Postgres, Redis available in dev + CI — use directly. `vi.spyOn` only for failure simulation. Clean up test side-effects.

**Naming:** `describe` titles = noun phrases (`'application health checks'`). `it` titles = `'should [outcome] [when/during condition]'`:

- `'should return 200 when the application and its dependencies are healthy'`
- `'should remove hyphens when converting an identifier to compact form'`

**Structure within `describe`:**

1. Hooks first (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`) — before `it` blocks
2. Each `it`: **setup → action → assertion → cleanup**

```ts
it('should return 500 when the database is unavailable during the health check', async () => {
  // setup
  const spy = vi.spyOn(orm.em, 'execute').mockRejectedValue(new Error('DB unavailable'));
  // action
  const { status } = await request({ route: APIRoute.Health });
  // assertion
  expect(status).toBe(HttpStatus.InternalServerError);
  // cleanup
  spy.mockRestore();
});
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`. Lowercase subjects. Frequent, focused commits — split by logical unit (separate commits for deps, config, tests, pipeline).

**Commit often, in dependency order.** Each commit must leave the codebase buildable so any commit can be checked out for point-in-time recovery. Commit dependencies before dependents:

```
Example — new login API:
  1. feat(auth): add login validation schema      ← no deps, safe standalone
  2. feat(auth): add user entity & repository     ← depends on schema
  3. feat(auth): add login service                 ← depends on entity/repo
  4. feat(auth): add login route                   ← depends on service
  5. test(auth): add login tests                   ← depends on route

Anti-pattern — committing service before schema:
  checking out commit "add login service" → imports schema that
  doesn't exist yet → build breaks → point-in-time recovery fails
```
