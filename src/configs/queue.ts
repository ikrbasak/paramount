import type { ConnectionOptions, DefaultJobOptions, QueueOptions, WorkerOptions } from 'bullmq';

import { env } from '@/configs/environment';
import { redisConfig } from '@/configs/redis';

export const redisConnOpt: ConnectionOptions = {
  ...redisConfig,
  url: env.REDIS_URL,
};

const defaultJobOptions: DefaultJobOptions = {
  keepLogs: 100,
  attempts: 5,
  removeOnComplete: { age: 60 * 60 * 24 },
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
};
