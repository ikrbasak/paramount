import Redis from 'ioredis';

import { env } from '@/configs/environment';
import { cacheRedisOptions } from '@/configs/redis';
import { logger } from '@/lib/logger';

export const cacheClient = new Redis(env.REDIS_URL, cacheRedisOptions);

cacheClient.on('error', (error) => logger.log('error', 'redis:cache:error', { error }));
cacheClient.on('reconnecting', (delay: number) =>
  logger.log('warn', 'redis:cache:reconnecting', { delay }),
);
cacheClient.on('end', () => logger.log('warn', 'redis:cache:end'));
