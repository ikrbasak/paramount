import type { RedisOptions } from 'ioredis';

const baseRedisOptions: RedisOptions = {
  enableOfflineQueue: false,
  enableReadyCheck: true,
  showFriendlyErrorStack: true,
};

// NOTE BullMQ uses blocking commands (BRPOP) on its connection. ioredis disables blocking
// commands when maxRetriesPerRequest is finite, so it MUST stay null for the BullMQ client.
export const bullmqRedisOptions: RedisOptions = {
  ...baseRedisOptions,
  maxRetriesPerRequest: null,
};

// NOTE The cache client only runs short request/response commands. Cap retries and set
// timeouts so a slow or unreachable Redis fails fast instead of hanging the request.
// BullMQ options intentionally omit these — its workers need long-poll BRPOP.
const CACHE_MAX_RETRIES_PER_REQUEST = 5;
export const cacheRedisOptions: RedisOptions = {
  ...baseRedisOptions,
  maxRetriesPerRequest: CACHE_MAX_RETRIES_PER_REQUEST,
  connectTimeout: 5000,
  commandTimeout: 2000,
};
