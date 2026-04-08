import type { RedisOptions } from 'ioredis';

export const redisConfig: RedisOptions = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  enableReadyCheck: true,
  showFriendlyErrorStack: true,
};
