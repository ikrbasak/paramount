import Redis from 'ioredis';

import { env } from '@/configs/environment';
import { redisConfig } from '@/configs/redis';

export const cacheClient = new Redis(env.REDIS_URL, redisConfig);
