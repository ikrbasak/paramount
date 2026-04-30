# CLAUDE.md

Keep this file current after architectural or non-obvious changes.

## Commands

```sh
bun run dev              # watch mode dev server
bun run build            # prebuild (tsc) + bundle (bun)
bun run fmt              # format (oxfmt)
bun run lint             # lint (oxlint --fix)
bun run test             # all tests
bun run test -- tests/path/to/file.ts  # single file
bun run test:cov         # with coverage
make migration:generate  # generate migration from schema changes
make migration:run       # apply pending migrations
make seeder:run          # run pending seeders
```

## Rules

- After every file change: run `fmt`, `lint`, `build` before done.
- Imports: absolute only via `@/` (src), `~/` (tests), `#/` (root). No relative paths.
- Runtime: Bun only. No npm/pnpm/yarn.
- Dependencies: prefer Bun built-ins first. If package needed, explain and ask before adding.
- CI/CD: GitHub Actions in `.github/workflows/`. Pin actions to exact SHAs with version comments. Read `docs/workflows.md` before modifying workflows; update it after.
- Transactions: wrap DB ops in MikroORM transaction, apply cache (Redis) mutations only after DB commit.
- Types: `type` over `interface` unless declaration merging needed.
- Zod: `import * as z from 'zod'` only — never default import.
- Env vars: never read `.env*` directly. Use `src/validators/schemas/environment.ts`.
- Bundling: Bun native bundler only.
- Datetime: precision 3 in MikroORM entities (`p.datetime(3)`), matches `BaseUuidEntity`.

## Architecture

Hono + Bun backend. PostgreSQL (MikroORM), Redis (ioredis), BullMQ.

**Request flow:** `src/index.ts` -> `src/server.ts` (middleware) -> `src/routes/` -> `src/services/` -> DB/cache/queues

**Middleware order:** logger -> CORS -> timing -> body limit -> timeout -> routes -> error handler

**Layer pattern:** route -> service -> repository

- Routes (`src/routes/`): validate with Zod via `requestValidate`, call service, return response. No business logic.
- Services (`src/services/`): business logic, call repositories.
- Repositories: thin MikroORM wrappers; ORM ops use `withOrmContext`.

### Key libs (`src/lib/`)

- `error/`: `CustomError`, `CustomZodError` with typed status codes. All caught at server level, formatted as `{ status, message, cause?, stack? }` via `ErrorFormat.format()`. Extend `CustomError` for domain errors; pre-built: `NotFoundError`.
- `logger/`: Pino + `AsyncLocalStorage` per-request `correlationId`. Read `docs/logging.md` before/after modifying; update it after.
- `queue/`: `BaseQueue`/`BaseWorker` (BullMQ), auto-inject ORM context + logger. Job types in `JobRegistry` (`src/lib/queue/types.ts`).
- `hono/`: `requestValidate` for Zod validation (body, query, params).

### Config

Env validated via Zod in `src/validators/schemas/`. Domain configs: `src/configs/{database,queue,redis,env}.ts`. Use config objects, not `process.env`.

### Database

Entities in `src/database/entities/`, registered in `src/configs/database.ts` `entities` array. `UnderscoreNamingStrategy` (camelCase -> snake_case). `SoftDeleteSubscriber` global. `ignoreUndefinedInQuery: true`. Migrations: `src/database/migrations/`, seeders: `src/database/seeders/`. CLI config: `mikro-orm.config.ts`.

`withOrmContext` applied globally in `server.ts` for HTTP requests. Required outside requests (scripts, queue jobs — `BaseWorker` handles it).

### Queues

- Dispatch via `queue.dispatch(data, opts?)` — never `queue.add(...)`.
- Workers don't auto-start (`autorun: false` in `src/configs/queue.ts`). Resumed in `initialize()` (`src/index.ts`); cleanup registered as disposer. New workers registered in `src/queues/`.
- New job types: add to `JobRegistry` in `src/lib/queue/types.ts`. Job names: PascalCase.
- `BaseWorker` attaches `failed`/`error`/`stalled` listeners — don't duplicate.

### Redis

`src/configs/redis.ts` exports two option objects:

- `bullmqRedisOptions`: for BullMQ. Keep `maxRetriesPerRequest: null` (required for blocking commands).
- `cacheRedisOptions`: for cache/rate-limit. Caps retries for fast failure.

Cache client (`src/cache/client.ts`) logs `error`/`reconnecting`/`end` — new clients should too.

### Lifecycle

`src/index.ts` uses a disposer stack (LIFO cleanup). Signal/crash handlers registered before `initialize()`. New long-lived resources: push cleanup into `disposers` where created.

### Constants (`src/constants/`)

- `APIRoute`: route paths. `APIRouteVersion`: version prefixes. Never hardcode paths.
- `ErrorMessage.Generic.*`: static strings. `ErrorMessage.Field.*`: parameterized factories. Never hardcode messages.
- `HttpStatus`: status code enum.
- Time values: named constants (`DEFAULT_MAX_TTL`, `SESSION_TIMEOUT`), no magic numbers, no generic names.

## Testing

- Unit: `tests/unit/`, integration: `tests/integration/`
- Global setup (`tests/setup/test.global.setup.ts`): drops/recreates schema, runs migrations + seeders
- Per-file setup (`tests/setup/test.setup.ts`): flushes Redis in `beforeAll`
- `tests/utils/request.ts`: typed HTTP helper for integration tests
- Vitest: `bail: 1`, `shuffle: { files: true }`, min one assertion per test
- Explicitly import `describe`, `it`, `expect`, etc. from `vitest`
- One top-level `describe` per file
- Minimize mocking: only external third-party APIs. Real Postgres/Redis in dev + CI. `vi.spyOn` only for failure simulation. Clean up side-effects.
- `describe` titles: noun phrases. `it` titles: `'should [outcome] [when/during condition]'`
- Structure within `describe`: hooks first, then `it` blocks. Each `it`: setup -> action -> assertion -> cleanup.

## Commits

Conventional Commits: `type(scope): subject`. Lowercase subjects. Frequent, focused — split by logical unit.

**Discrete steps:** (1) `git add` files, (2) `git commit`. Push only as step 3 if requested. Never combine staging and committing.

**Dependency order.** Each commit must be independently buildable. Commit dependencies before dependents.

```
Example — new login API:
  1. feat(auth): add login validation schema
  2. feat(auth): add user entity & repository
  3. feat(auth): add login service
  4. feat(auth): add login route
  5. test(auth): add login tests
```
