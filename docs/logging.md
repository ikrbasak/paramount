# Logging

Typed, structured logging built on Pino with `AsyncLocalStorage` for per-request/job context propagation. All log keys and their data shapes are enforced at compile time via TypeScript registries.

## Methods

| Method   | Signature                          | Behavior                                                         |
| -------- | ---------------------------------- | ---------------------------------------------------------------- |
| `.log`   | `log(level, key, data?, options?)` | Inside ALS: accumulates into wide event. Outside: immediate emit |
| `.audit` | `audit(key, data?)`                | Always emits immediately at `info` level with `audit: true`      |

### `.log(level, key, data?, options?)`

Context-aware logging method. Behavior depends on whether the call is inside an `AsyncLocalStorage` context (`withLogContext`):

- **Inside ALS** — data accumulates into the wide event store. Nothing emits until scope exits.
- **Outside ALS** — emits immediately via Pino at the given level.
- **`{ immediate: true }`** — inside ALS, adds to wide event AND emits immediately. Use for errors or events that need both wide event context and instant visibility.

```ts
// inside withLogContext — accumulated, flushed at scope exit
logger.log('info', 'hono:req:context', { reqId, url, method });

// outside withLogContext — emitted immediately
logger.log('error', 'config:env:failed', { issues });

// inside withLogContext with immediate — both accumulated and emitted
logger.log('error', 'hono:req:failed', { message, stack, cause }, { immediate: true });

// no-data keys
logger.log('info', 'bull:job:succeeded');
```

### `.audit(key, data?)`

Business and compliance events. Always emits immediately at `info` level. Output includes `audit: true` marker for filtering.

```ts
logger.audit('sample:audit', { message: 'user performed action' });
```

## Registries

All log keys and their data shapes are defined in `src/lib/logger/types.ts`. Two registries:

- **`LogRegistry`** — keys valid for `.log()`. Every key maps to its expected data type (or `NoData` for keys with no payload).
- **`AuditRegistry`** — superset of `LogRegistry`. All `.log()` keys are valid `.audit()` keys. Audit-specific keys are added here.

Using an unregistered key or passing the wrong data shape produces a TypeScript compile error.

### Adding a new log key

1. Add the key and its data type to `LogRegistry` in `src/lib/logger/types.ts`:

```ts
export type LogRegistry = {
  // ...existing keys
  'feature:action:completed': { featureId: string; duration: number };
};
```

2. Use it anywhere:

```ts
logger.log('info', 'feature:action:completed', { featureId: '123', duration: 42 });
```

### Adding an audit-only key

Add to the `AuditRegistry` extension (not `LogRegistry`):

```ts
export type AuditRegistry = LogRegistry & {
  'user:role:changed': { userId: string; from: string; to: string };
};
```

## Key naming convention

Keys must be short, colon-namespaced, and grep-friendly. No sentences or natural language.

```
✓  'hono:req:context'       'bull:job:failed'        'redis:cache:error'
✗  'Request started'        'The job has failed'     'Redis connection error'
```

Pattern: `domain:subject:action` (e.g., `bull:worker:stalled`, `orm:debug`, `config:env:failed`).

## Wide events

Wide events aggregate all `.log()` calls within a single request or job into one JSON line, emitted at scope exit.

### How it works

1. `withLogContext` creates an ALS scope with a `correlationId` and an empty event store.
2. Each `.log()` call inside the scope pushes a discrete event (with `key`, `level`, `ts`, and data) into the store.
3. When the scope exits (via `finally` block), all accumulated events flush as a single log line under the `wide:event` key.
4. If the scope exits due to an error, the flush emits at `error` level; otherwise `info`.

### Output format

```json
{
  "level": 30,
  "ts": 1777179129965,
  "deployment": "73647569843759473956734",
  "correlationId": "019dc821-7847-7001-8cd6-3c670344fc88",
  "events": [
    {
      "key": "hono:req:context",
      "level": "info",
      "ts": 1777179129929,
      "reqId": "019dc821-7847-7000-b308-3554351dc284",
      "url": "http://localhost:8080/api/v1/health",
      "method": "GET"
    },
    {
      "key": "hono:req:completed",
      "level": "info",
      "ts": 1777179129965,
      "duration": 36.35
    }
  ],
  "key": "wide:event"
}
```

Each event entry preserves its own `key`, `level`, `ts`, and data fields. The top-level `correlationId` ties all events to the same request or job.

### Where `withLogContext` is applied

- **HTTP requests** — `src/server.ts` middleware wraps every request.
- **Queue jobs** — `BaseWorker` in `src/lib/queue/index.ts` wraps every job processor.

Both are applied automatically. Route handlers and job processors do not call `withLogContext` manually.

## Context propagation

`AsyncLocalStorage` provides automatic context propagation across `async`/`await` boundaries. The `correlationId` is generated once per scope and attached to every log line (both wide events and immediate emits).

```ts
export const withLogContext = <T>(fn: () => Bun.MaybePromise<T>): Bun.MaybePromise<T> => {
  const store: LogContextStore = {
    logger: baseLogger.child({ correlationId: UuidUtil.generate() }),
    events: [],
  };

  return logContextStorage.run(store, async () => {
    let hadError = false;
    try {
      return await fn();
    } catch (error) {
      hadError = true;
      throw error;
    } finally {
      logger.flush(hadError);
    }
  });
};
```

## Pino configuration

| Setting       | Value                                             |
| ------------- | ------------------------------------------------- |
| `messageKey`  | `'key'` — log messages appear under `key` in JSON |
| `timestamp`   | Custom: outputs `ts` field (epoch ms), not `time` |
| `base`        | `{ deployment: LOG_DEPLOYMENT_ID }`               |
| `redact`      | Removes `password`, `secret`, `token` fields      |
| `serializers` | `errWithCause` for `err` and `error` fields       |
| `level`       | Set via `LOG_LEVEL` env var                       |

New sensitive fields must be added to the redact paths list in `src/lib/logger/index.ts`.

## File structure

| File                             | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `src/lib/logger/index.ts`        | Pino instance, ALS setup, `withLogContext`                |
| `src/lib/logger/typed-logger.ts` | `TypedLogger` class with `.log()`, `.audit()`, `.flush()` |
| `src/lib/logger/types.ts`        | `LogRegistry`, `AuditRegistry`, `WideEvent`, `LogOptions` |
