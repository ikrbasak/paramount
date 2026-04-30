# Logging

Typed, structured logging on Pino with `AsyncLocalStorage` for per-request/job context. All log keys and data shapes enforced at compile time via registries in `src/lib/logger/types.ts`.

## Methods

**`.log(level, key, data?, options?)`** — context-aware:

- Inside ALS (`withLogContext`): accumulates into wide event, emits at scope exit
- Outside ALS: emits immediately
- `{ immediate: true }`: adds to wide event AND emits immediately (use for errors needing both)

**`.audit(key, data?)`** — always emits immediately at `info` level with `audit: true`. For business/compliance events.

## Registries

Defined in `src/lib/logger/types.ts`:

- `LogRegistry`: keys valid for `.log()`. Each key maps to expected data type (or `NoData`).
- `AuditRegistry`: superset of `LogRegistry`. Audit-only keys added here.

Unregistered key or wrong data shape = compile error.

**Adding a log key:** add to `LogRegistry` with data type. **Adding an audit-only key:** add to `AuditRegistry` extension (not `LogRegistry`).

## Key naming

Colon-namespaced, grep-friendly. Pattern: `domain:subject:action`.

Valid: `hono:req:context`, `bull:job:failed`, `redis:cache:error`
Invalid: `Request started`, `The job has failed`

## Wide events

All `.log()` calls within a single `withLogContext` scope aggregate into one JSON line, emitted at scope exit. Error in scope -> flush at `error` level; otherwise `info`.

Each event entry has: `key`, `level`, `ts`, data fields. Top-level `correlationId` ties events to same request/job.

`withLogContext` applied automatically:

- HTTP requests: `src/server.ts` middleware
- Queue jobs: `BaseWorker` in `src/lib/queue/index.ts`

Route handlers and job processors never call `withLogContext` manually.

## Pino config

- `messageKey`: `'key'` (log messages under `key` in JSON)
- `timestamp`: `ts` field (epoch ms)
- `base`: `{ deployment: LOG_DEPLOYMENT_ID }`
- `redact`: removes `password`, `secret`, `token` fields. Add new sensitive fields to redact paths in `src/lib/logger/index.ts`.
- `serializers`: `errWithCause` for `err`/`error` fields
- `level`: from `LOG_LEVEL` env var
