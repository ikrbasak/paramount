import { setTimeout as delay } from 'node:timers/promises';

import type { Job } from 'bullmq';

import { logger } from '@/lib/logger';
import { BaseQueue, BaseWorker } from '@/lib/queue';
import type { JobRegistry } from '@/lib/queue/types';

export class SampleLogQueue extends BaseQueue<'SampleLog'> {}

export class SampleLogQueueWorker extends BaseWorker<'SampleLog'> {
  async processor(job: Job<JobRegistry['SampleLog'], null, 'SampleLog'>) {
    await delay(1000);
    logger.info({ jobId: job.id, content: job.data.content }, 'sample:log:completed');
  }
}
