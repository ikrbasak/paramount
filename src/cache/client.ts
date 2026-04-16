import Redis from 'ioredis';

import { env } from '@/configs/environment';
import { redisConfig } from '@/configs/redis';
import { logger } from '@/lib/logger';

const CLIENT_MAX_RETRIES = 5;
export const cacheClient = new Redis(env.REDIS_URL, {
  ...redisConfig,
  maxRetriesPerRequest: CLIENT_MAX_RETRIES,
});

cacheClient.on('error', (error) => logger.error({ error }, 'redis:cache:error'));
cacheClient.on('reconnecting', (delay: number) =>
  logger.warn({ delay }, 'redis:cache:reconnecting'),
);
cacheClient.on('end', () => logger.warn('redis:cache:end'));
