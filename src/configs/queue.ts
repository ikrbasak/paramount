import type { ConnectionOptions, DefaultJobOptions, QueueOptions, WorkerOptions } from 'bullmq';

import { env } from '@/configs/environment';
import { bullmqRedisOptions } from '@/configs/redis';

export const redisConnOpt: ConnectionOptions = {
  ...bullmqRedisOptions,
  url: env.REDIS_URL,
};

const defaultJobOptions: DefaultJobOptions = {
  keepLogs: 100,
  attempts: 5,
  // NOTE cap by both age and count so Redis memory stays bounded under bursty traffic.
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
  backoff: {
    type: 'exponential',
    delay: 1000 * 5,
  },
};

export const defaultQueueOptions: QueueOptions = {
  defaultJobOptions,
  connection: redisConnOpt,
};

export const defaultWorkerOptions: WorkerOptions = {
  concurrency: 1,
  connection: redisConnOpt,
  autorun: false,
  // NOTE BullMQ moves a job to failed once it stalls more than this many times.
  maxStalledCount: 3,
};
