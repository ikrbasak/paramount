# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Maintenance note for Claude**: keep this file up to date. After making architectural changes, adding non-obvious patterns, or any work that future instances would benefit from knowing, update this file accordingly.

## Commands

```sh
# Development
bun run dev                # watch mode dev server

# Build
bun run build              # prebuild (tsc) + bundle (bun)

# Code quality (run all after changes)
bun run fmt                # format with oxfmt
bun run lint               # lint with oxlint --fix
bun run knip               # find unused files/exports
bun run knip:p             # check production unused only
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

- **After every file change**: run `bun run fmt`, `bun run lint`, `bun run knip`, `bun run knip:p`, and `bun run build` before considering work done.
- **Imports**: always use absolute imports via the path aliases (`@/`, `~/`, `#/`) — no relative paths.
- **Runtime**: this project exclusively uses Bun. Never use `npm`, `pnpm`, or `yarn` for any command.
- **Dependencies**: prefer Bun built-ins (file I/O, `Bun.serve`, `Bun.password`, etc.) before reaching for a package. If a package is genuinely needed, explain the choice in 2–3 sentences and ask for confirmation before adding it.
- **CI/CD**: the project uses GitHub Actions (`.github/workflows/`). Keep that in mind when touching build config, env vars, or scripts. Always pin `uses` actions to exact commit SHAs with version comments (e.g. `uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1`).
- **Transactions**: when a feature writes to both the database and cache (Redis), ensure atomicity — wrap DB operations in a MikroORM transaction and apply cache mutations only after the DB transaction commits successfully.
- **Zod imports**: always use `import * as z from 'zod'` — never the default import (`import z from 'zod'`).
- **Bundling**: uses Bun's native bundler — do not add or suggest alternative bundler config or dependencies.
- **Datetime precision**: always use precision 3 for datetime columns in MikroORM entities (e.g. `p.datetime(3)`) — consistent with `BaseUuidEntity` in `src/database/helpers/index.ts`.

## Architecture

**Paramount** is a Hono + Bun backend with PostgreSQL (MikroORM), Redis (ioredis), and BullMQ.

### Request lifecycle

`src/index.ts` → `src/server.ts` (middleware stack, error handler) → `src/routes/` (handlers) → `src/services/` (business logic) → database/cache/queues

Server middleware chain (in order): logger → CORS → timing debugger → body limit → timeout → routes → global error handler.

### Layered structure

All features follow a **router → service → repository** pattern:

- **Routes** (`src/routes/`) — validate input with Zod via `zValidator`, call a service, return a response. No business logic here.
- **Services** (`src/services/`) — orchestrate business logic, call repositories.
- **Repositories** — thin wrappers around MikroORM entity managers; all ORM operations must run inside a context provided by `withOrmContext`.

### Key libraries in `src/lib/`

- **`error/`** — Custom error hierarchy (`AppError`, `HttpError`, etc.) with typed status codes. All errors caught at the server level and formatted as JSON.
- **`logger/`** — Pino logger wrapped with `AsyncLocalStorage` for per-request `logId` tracing across async boundaries. Wrap async work in `withLogContext` so the log context propagates correctly.
- **`queue/`** — Abstract `BaseQueue` and `BaseWorker` classes (BullMQ) that auto-inject an ORM context and logger into every job. New job types must be added to `src/lib/queue/types.ts` (`JobRegistry`) — each entry maps a job name to its payload type. See [Queues](#queues) below for usage rules.
- **`hono/`** — `zValidator` wrapper for Zod-based request validation (body, query, params).

### Config & validation

All env vars are validated via Zod schemas in `src/validators/schemas/`. Configs are split by domain: `src/configs/{database,queue,redis,env}.ts`. Use the domain-specific config object rather than reading `process.env` directly.

### Database

Entities live in `src/database/entities/` and must be added to the `entities` array in `src/configs/database.ts`. MikroORM uses `UnderscoreNamingStrategy` (camelCase properties → snake_case columns). `SoftDeleteSubscriber` is globally registered. `ignoreUndefinedInQuery: true` means passing `undefined` in a query simply omits the condition. Migrations live in `src/database/migrations/`, seeders in `src/database/seeders/`. `mikro-orm.config.ts` at root is for the CLI. DB commands are in the `Makefile`.

`withOrmContext` is applied globally in `server.ts` for all HTTP requests — routes and services do not need to call it manually. It is required when running database code outside a request (e.g. scripts, queue jobs — `BaseWorker` handles this automatically).

### Queues

BullMQ queues and workers are defined in `src/lib/queue/`. Key rules:

- **Dispatch jobs via `queue.dispatch(data, opts?)`** — never call `queue.add(...)` directly. `dispatch` is a typed wrapper that ensures the correct job name and payload type from `JobRegistry`.
- **Workers do not auto-start.** `defaultWorkerOptions` sets `autorun: false` (`src/configs/queue.ts`), so workers must be explicitly resumed at startup. This is handled in `src/index.ts` via `workers.map(w => w.resume())` — any new worker must be registered in `src/queues/` so it gets picked up there.
- **New job types** must be added to `JobRegistry` in `src/lib/queue/types.ts` — each entry maps a job name to its payload type. **Job names must use PascalCase** (e.g. `EmailSend`).

### Error handling

Throw `CustomError` (or subclass it for domain-specific errors) for domain errors; throw `CustomZodError` for validation errors. Both accept a `cause` object for structured context. All errors are caught by the server and normalized through `ErrorFormat.format()` into `{ status, message, cause?, stack? }`.

Extend `CustomError` when a dedicated error type adds clarity:

```ts
export class ForbiddenError extends CustomError {
  constructor(msg: string, cause: ErrorContext = {}) {
    super(HttpStatus.Forbidden, msg, cause);
  }
}
```

Pre-built subclasses: `NotFoundError`. Add others (e.g. `UnprocessableEntityError`, `ForbiddenError`, `ConflictError`) as features require them.

### Constants

Centralized in `src/constants/`:

- **`APIRoute`** — route path strings (`satisfies Record<string, string>`). **`APIRouteVersion`** — version prefixes (e.g. `/api/v1`). Never hardcode path strings in handlers.
- **`ErrorMessage.Generic.*`** — static strings. **`ErrorMessage.Field.*`** — parameterized factory functions (e.g. `ErrorMessage.Field.LabelNotFound('User')`). Never hardcode message strings inline.
- **`HttpStatus`** — HTTP status code enum.
- **`Duration`** — named time constants. Avoid magic numbers; use named constants wherever one exists.

### Logging

Use structured Pino logging. The log **message** argument must be a short, dot-namespaced, grep-friendly key — not a human sentence (e.g. `'bull:job:started'`, `'user:login:failed'`). Put variable data in the preceding object:

```ts
logger.info({ userId, duration }, 'user:login:succeeded');
```

Use `withLogContext` to wrap any async work where you want the request `correlationId` to propagate (route handlers, queue processors, etc.). The logger automatically redacts fields named `password`, `secret`, or `token` — if new sensitive fields are introduced, update the redact list in `src/lib/logger/index.ts`.

### Path aliases

| Alias | Resolves to |
| ----- | ----------- |
| `@/*` | `src/*`     |
| `~/`  | `tests/*`   |
| `#/`  | root        |

### Testing conventions

- Unit tests: `tests/unit/`, integration tests: `tests/integration/`
- Global setup (`tests/setup/test.global.setup.ts`) drops/recreates schema, runs migrations and seeders
- Per-test setup (`tests/setup/test.setup.ts`) flushes Redis before each test
- `tests/utils/request.ts` provides a typed HTTP helper for integration tests
- Vitest is configured with `bail: 1`, `shuffle: { files: true }`, and requires at least one assertion per test
- Always explicitly import test globals (`describe`, `it`, `expect`, `beforeEach`, etc.) from `vitest` — do not rely on auto-injection
- Each test file must have exactly one top-level `describe` block; nest additional `describe` blocks inside it as needed
- For any new or updated feature, write or update the corresponding test cases. Tests must be extensive — cover happy paths, edge cases, error/failure paths, and boundary conditions to validate correct implementation and catch unforeseen regressions.
- **Minimize mocking**: only mock what absolutely cannot run in the test environment (e.g. external third-party APIs). Real Postgres, Redis, and Typst are available in both local dev and CI — use them directly instead of mocking. Use `vi.spyOn` only when you need to simulate a failure path (e.g. DB/Redis errors). Always clean up test side-effects (e.g. delete inserted rows, drain queues, flush Redis keys).

**Naming:** `describe` titles are noun phrases describing the domain (`'application health checks'`, `'identifier generation and formatting utilities'`). `it` titles follow `'should [outcome] [when/during condition]'`:

- `'should return 200 when the application and its dependencies are healthy'`
- `'should remove hyphens when converting an identifier to compact form'`

**Structure within each `describe` block:**

1. Hooks first (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`) — before any `it` blocks
2. Each `it` body follows: **setup → action → assertion → cleanup**

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

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`. Prefer lowercase commit subjects. Make frequent, focused commits rather than one large commit per feature or fix. No single commit should contain too many changes — split by logical unit (e.g. separate commits for deps, config, tests, pipeline).
