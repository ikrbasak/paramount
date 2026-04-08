import dotenv from 'dotenv-flow';
import * as z from 'zod';

import { stringBooleanField, stringEnumField } from '@/validators/common/field';

dotenv.config({ purge_dotenv: true, silent: true });

const runtimeEnvironmentSchema = z.object({
  NODE_ENV: stringEnumField('NODE_ENV', ['development', 'test', 'production']).default(
    'development',
  ),
  CI: stringBooleanField('CI').default(false),
});

const serverEnvironmentSchema = z.object({
  SERVER_PORT: z.coerce
    .number()
    .int()
    .min(8000)
    .max(8999)
    .default(8080)
    .describe('SERVER_PORT must explicitly be 8080'),
  SERVER_CORS_ALLOWED_ORIGIN: z.coerce
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.split(',')),
  SERVER_CORS_ALLOW_CREDENTIALS: stringBooleanField('SERVER_CORS_ALLOW_CREDENTIALS').default(false),
  SERVER_ENABLE_TIMING_DEBUGGER: stringBooleanField('SERVER_ENABLE_TIMING_DEBUGGER').default(false),
  SERVER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000 * 5)
    .max(1000 * 28)
    .default(1000 * 10),
  SERVER_MAX_BODY_SIZE_KB: z.coerce
    .number()
    .positive()
    .min(64)
    .max(512)
    .default(128)
    .transform((v) => v * 1024),
  SERVER_ENABLE_ERROR_STACK: stringBooleanField('SERVER_ENABLE_ERROR_STACK').default(false),
});

export const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url({ error: 'PostgreSQL connection string is invalid' }),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).default(20),
  DATABASE_APP_NAME: z.coerce.string().min(4).default('application'),
  DATABASE_CONN_TIMEOUT_MS: z.coerce.number().int().min(1).default(10_000),
  DATABASE_SSL_CERTIFICATE: z
    .string()
    .optional()
    .transform((v) => v?.split(String.raw`\n`).join('\n')),
  DATABASE_DEBUG: stringBooleanField('Database log flag').default(false),
});

export const logEnvironmentSchema = z.object({
  LOG_LEVEL: stringEnumField('Log level', [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]).default('info'),
  LOG_DEPLOYMENT_ID: z.coerce.string(),
});

const redisEnvironmentSchema = z.object({
  REDIS_URL: z.url(),
});

export const environmentSchema = z
  .object()
  .extend(runtimeEnvironmentSchema.shape)
  .extend(serverEnvironmentSchema.shape)
  .extend(databaseEnvironmentSchema.shape)
  .extend(logEnvironmentSchema.shape)
  .extend(redisEnvironmentSchema.shape)
  .readonly();
