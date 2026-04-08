import Redis from 'ioredis';
import { beforeAll } from 'vitest';

import { env } from '@/configs/environment';

beforeAll(async () => {
  const redis = new Redis(env.REDIS_URL);
  await redis.flushdb();
  redis.disconnect();
});
