import type pino from 'pino';

import type {
  AddRegistry,
  AuditRegistry,
  LogLevel,
  LogRegistry,
  RegistryData,
} from '@/lib/logger/types';

export type WideEventStore = {
  keys: string[];
  data: Record<string, unknown>;
};

export type LogContextStore = {
  logger: pino.Logger;
  wide: WideEventStore;
};

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

  log<K extends keyof LogRegistry>(
    level: LogLevel,
    key: K,
    ...args: RegistryData<LogRegistry, K>
  ): void {
    this.emit(this.resolve(), level, key, args[0] ?? undefined);
  }

  audit<K extends keyof AuditRegistry>(key: K, ...args: RegistryData<AuditRegistry, K>): void {
    this.emit(this.resolve(), 'info', key, { ...args[0], audit: true });
  }

  add<K extends keyof AddRegistry>(key: K, ...args: RegistryData<AddRegistry, K>): void {
    const store = this.getStore();
    const data = args[0] ?? undefined;

    if (store) {
      store.wide.keys.push(key);
      if (data) {
        Object.assign(store.wide.data, data);
      }
    } else {
      this.emit(this.baseLogger, 'info', key, data);
    }
  }

  flush(error?: boolean): void {
    const store = this.getStore();
    if (!store || store.wide.keys.length === 0) {
      return;
    }

    const level: LogLevel = error ? 'error' : 'info';
    const { keys, data } = store.wide;
    this.emit(store.logger, level, 'wide:event', { ...data, keys });

    store.wide.keys = [];
    store.wide.data = {};
  }
}
