/** Sentinel for registry keys that carry no data. */
// oxlint-disable-next-line no-invalid-void-type
export type NoData = void;

/** Log levels supported by operational logging. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Operational log keys → data shapes.
 * Every `.log()` call must use a key from this registry with matching data.
 */
export interface LogRegistry {
  // hono
  'hono:req:failed': { message: string; stack?: string; cause?: unknown };

  // redis
  'redis:cache:error': { error: unknown };
  'redis:cache:reconnecting': { delay: number };
  'redis:cache:end': NoData;

  // config
  'config:db:env:failed': { issues: unknown[] };
  'config:env:failed': { issues: unknown[] };

  // orm
  'orm:debug': {
    query?: string;
    params?: unknown;
    took?: number;
    results?: number;
    namespace: string;
  };

  // bull queue
  'bull:job:failed': { error: unknown; remaining: number };
  'bull:worker:failed': { queue: string; jobId?: string; error: unknown };
  'bull:worker:error': { queue: string; error: unknown };
  'bull:worker:stalled': { queue: string; jobId: string };

  // sample
  'sample:log:completed': { jobId: string | undefined; content: string };
}

/**
 * Wide event keys → data shapes.
 * `.add()` accumulates these into ALS context; flushed as single log at scope exit.
 */
export interface AddRegistry {
  // hono request lifecycle
  'hono:req:context': { reqId: string; url: string; method: string };
  'hono:req:completed': { duration: number };

  // bull job lifecycle
  'bull:job:started': { jobId: string | undefined; queue: string; upstream?: unknown };
  'bull:job:succeeded': NoData;
  'bull:job:completed': { duration: number };
}

/**
 * Audit event keys → data shapes.
 * `.audit()` always emits at info level with `audit: true` marker.
 */
export interface AuditRegistry {
  'sample:audit': { message: string };
}

/** Helper: extract data param type. `NoData` keys require no data arg. */
// oxlint-disable-next-line no-invalid-void-type
export type RegistryData<R, K extends keyof R> = R[K] extends void ? [] : [data: R[K]];
