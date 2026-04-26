// oxlint-disable-next-line no-invalid-void-type
export type NoData = void;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogRegistry = {
  'hono:req:context': { reqId: string; url: string; method: string };
  'hono:req:completed': { duration: number };
  'hono:req:failed': { message: string; stack?: string; cause?: unknown };

  'redis:cache:error': { error: unknown };
  'redis:cache:reconnecting': { delay: number };
  'redis:cache:end': NoData;

  'config:db:env:failed': { issues: unknown[] };
  'config:env:failed': { issues: unknown[] };

  'orm:debug': {
    query?: string;
    params?: unknown;
    took?: number;
    results?: number;
    namespace: string;
  };

  'bull:job:started': { jobId: string | undefined; queue: string; upstream?: unknown };
  'bull:job:succeeded': NoData;
  'bull:job:failed': { error: unknown; remaining: number };
  'bull:job:completed': { duration: number };
  'bull:worker:failed': { queue: string; jobId?: string; error: unknown };
  'bull:worker:error': { queue: string; error: unknown };
  'bull:worker:stalled': { queue: string; jobId: string };

  'sample:log:completed': { jobId: string | undefined; content: string };
};

export type AuditRegistry = LogRegistry & {
  'sample:audit': { message: string };
};

export type WideEvent = {
  key: string;
  level: LogLevel;
  ts: number;
  [field: string]: unknown;
};

export type LogOptions = {
  immediate?: boolean;
};

// oxlint-disable-next-line no-invalid-void-type
export type RegistryData<R, K extends keyof R> = R[K] extends void ? [] : [data: R[K]];
