import type pino from 'pino';

import type {
  AuditRegistry,
  LogLevel,
  LogOptions,
  LogRegistry,
  NoData,
  RegistryData,
  WideEvent,
} from '@/lib/logger/types';

export type LogContextStore = {
  logger: pino.Logger;
  events: WideEvent[];
};

type ParsedLogArgs = {
  data: object | undefined;
  options: unknown;
};

type LogArgs<K extends keyof LogRegistry> = LogRegistry[K] extends NoData
  ? [level: LogLevel, key: K, options?: LogOptions]
  : [level: LogLevel, key: K, data: LogRegistry[K], options?: LogOptions];

export class TypedLogger {
  private readonly baseLogger: pino.Logger;
  private readonly getStore: () => LogContextStore | undefined;

  constructor(baseLogger: pino.Logger, getStore: () => LogContextStore | undefined) {
    this.baseLogger = baseLogger;
    this.getStore = getStore;
  }

  private resolve(): pino.Logger {
    return this.getStore()?.logger ?? this.baseLogger;
  }

  private emit(target: pino.Logger, level: LogLevel, key: string, data?: object): void {
    if (data) {
      target[level](data, key);
    } else {
      target[level](key);
    }
  }

  private parseLogArgs(args: unknown[]): ParsedLogArgs {
    if (args.length === 0) {
      return { data: undefined, options: undefined };
    }

    if (args.length === 1) {
      const first = args[0];
      if (first && typeof first === 'object' && 'immediate' in first) {
        return { data: undefined, options: first };
      }
      return { data: (first ?? undefined) as object | undefined, options: undefined };
    }

    return { data: (args[0] ?? undefined) as object | undefined, options: args[1] };
  }

  log<K extends keyof LogRegistry>(...logArgs: LogArgs<K>): void {
    const level = logArgs[0];
    const key = logArgs[1];
    const { data, options } = this.parseLogArgs(logArgs.slice(2));
    const store = this.getStore();

    if (store) {
      const event: WideEvent = { key, level, ts: Date.now() };
      if (data) {
        Object.assign(event, data);
      }
      store.events.push(event);

      if (options && typeof options === 'object' && 'immediate' in options && options.immediate) {
        this.emit(store.logger, level, key, data);
      }
    } else {
      this.emit(this.baseLogger, level, key, data);
    }
  }

  audit<K extends keyof AuditRegistry>(key: K, ...args: RegistryData<AuditRegistry, K>): void {
    this.emit(this.resolve(), 'info', key, { ...args[0], audit: true });
  }

  flush(error?: boolean): void {
    const store = this.getStore();
    if (!store || store.events.length === 0) {
      return;
    }

    const level: LogLevel = error ? 'error' : 'info';
    this.emit(store.logger, level, 'wide:event', { events: store.events });
    store.events = [];
  }
}
