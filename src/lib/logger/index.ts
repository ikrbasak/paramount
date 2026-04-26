import { AsyncLocalStorage } from 'node:async_hooks';

import pino, { stdSerializers } from 'pino';

import { TypedLogger, type LogContextStore } from '@/lib/logger/typed-logger';
import { UuidUtil } from '@/utils/uuid';
import { logEnvironmentSchema } from '@/validators/schemas/environment';

const { LOG_LEVEL, LOG_DEPLOYMENT_ID } = logEnvironmentSchema.parse(process.env);
const logContextStorage = new AsyncLocalStorage<LogContextStore>();

const baseLogger = pino({
  level: LOG_LEVEL,
  base: { deployment: LOG_DEPLOYMENT_ID },
  messageKey: 'key',
  redact: {
    remove: true,
    // NOTE keep this list up to date when adding new sensitive fields.
    paths: ['password', 'secret', 'token'],
  },
  serializers: { err: stdSerializers.errWithCause, error: stdSerializers.errWithCause },
});

export const logger = new TypedLogger(baseLogger, () => logContextStorage.getStore());

export const withLogContext = <T>(fn: () => Bun.MaybePromise<T>): Bun.MaybePromise<T> => {
  const store: LogContextStore = {
    logger: baseLogger.child({ correlationId: UuidUtil.generate() }),
    wide: { keys: [], data: {} },
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
