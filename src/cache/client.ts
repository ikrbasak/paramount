import Redis from 'ioredis';

import { env } from '@/configs/environment';
import { cacheRedisOptions } from '@/configs/redis';
import { logger } from '@/lib/logger';

export const cacheClient = new Redis(env.REDIS_URL, cacheRedisOptions);

cacheClient.on('error', (error) => logger.error({ error }, 'redis:cache:error'));
cacheClient.on('reconnecting', (delay: number) =>
  logger.warn({ delay }, 'redis:cache:reconnecting'),
);
cacheClient.on('end', () => logger.warn('redis:cache:end'));
