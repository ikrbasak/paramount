import type pino from 'pino';

import type {
  AuditRegistry,
  LogLevel,
  LogRegistry,
  RegistryData,
  WideEvent,
} from '@/lib/logger/types';

export type LogContextStore = {
  logger: pino.Logger;
  events: WideEvent[];
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

  add<K extends keyof LogRegistry>(key: K, ...args: RegistryData<LogRegistry, K>): void {
    const store = this.getStore();
    const data = args[0] ?? undefined;

    if (store) {
      const event: WideEvent = { key, time: Date.now() };
      if (data) {
        Object.assign(event, data);
      }
      store.events.push(event);
    } else {
      this.emit(this.baseLogger, 'info', key, data);
    }
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
