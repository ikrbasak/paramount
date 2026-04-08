import {
  DefaultLogger,
  defineConfig,
  UnderscoreNamingStrategy,
  type LogContext,
  type LoggerNamespace,
} from '@mikro-orm/postgresql';

import { User } from '@/database/entities/user';
import { SoftDeleteSubscriber } from '@/database/helpers';
import { logger } from '@/lib/logger';
import { databaseEnvironmentSchema } from '@/validators/schemas/environment';

const result = databaseEnvironmentSchema.readonly().safeParse(process.env);

if (result.error) {
  logger.error({ issues: result.error.issues }, 'config:db:env:failed');
  // oxlint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const dbenv = result.data;
const entities = [User];
const subscribers = [new SoftDeleteSubscriber()];

class OrmLogger extends DefaultLogger {
  log(namespace: LoggerNamespace, _message: string, context?: LogContext): void {
    if (!this.isEnabled(namespace, context) || !context) {
      return;
    }

    const { query, params, took, results } = context;
    logger.debug({ query, params, took, results }, `orm:${namespace}`);
  }
}

export const config = defineConfig({
  clientUrl: dbenv.DATABASE_URL,
  schema: 'public',
  name: dbenv.DATABASE_APP_NAME,
  pool: {
    min: 2,
    max: dbenv.DATABASE_POOL_SIZE,
    idleTimeoutMillis: dbenv.DATABASE_CONN_TIMEOUT_MS,
  },
  entities,
  subscribers,
  forceUtcTimezone: true,
  ignoreUndefinedInQuery: true,
  loadStrategy: 'balanced',
  useBatchInserts: true,
  useBatchUpdates: true,
  driverOptions: dbenv.DATABASE_SSL_CERTIFICATE
    ? {
        connection: {
          ssl: {
            rejectUnauthorized: true,
            ca: dbenv.DATABASE_SSL_CERTIFICATE,
          },
        },
      }
    : undefined,
  namingStrategy: UnderscoreNamingStrategy,
  serialization: { forceObject: true },
  debug: dbenv.DATABASE_DEBUG ? ['query', 'query-params', 'slow-query'] : false,
  loggerFactory: (opt) => new OrmLogger(opt),
});
