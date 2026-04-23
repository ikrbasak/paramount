import { AsyncLocalStorage } from 'node:async_hooks';

import pino, { stdSerializers } from 'pino';

import { UuidUtil } from '@/utils/uuid';
import { logEnvironmentSchema } from '@/validators/schemas/environment';

const { LOG_LEVEL, LOG_DEPLOYMENT_ID } = logEnvironmentSchema.parse(process.env);
const logContextStorage = new AsyncLocalStorage<pino.Logger>();

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

export const withLogContext = <T>(fn: () => Bun.MaybePromise<T>) =>
  logContextStorage.run(baseLogger.child({ correlationId: UuidUtil.generate() }), fn);

export const logger: pino.Logger = new Proxy(baseLogger, {
  get(target, prop) {
    const source = logContextStorage.getStore() ?? target;
    const val = Reflect.get(source, prop, source) as unknown;
    return typeof val === 'function' ? (val.bind(source) as unknown) : val;
  },
});
