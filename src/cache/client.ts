import Redis from 'ioredis';

import { env } from '@/configs/environment';
import { redisConfig } from '@/configs/redis';

const CLIENT_MAX_RETRIES = 5;
export const cacheClient = new Redis(env.REDIS_URL, {
  ...redisConfig,
  maxRetriesPerRequest: CLIENT_MAX_RETRIES,
});
