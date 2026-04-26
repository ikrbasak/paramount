import { Queue, type JobsOptions, Worker, type Job, type WorkerOptions } from 'bullmq';

import { defaultQueueOptions, defaultWorkerOptions, redisConnOpt } from '@/configs/queue';
import { withOrmContext } from '@/database/connection';
import { logger, withLogContext } from '@/lib/logger';
import type { JobRegistry } from '@/lib/queue/types';

const QUEUE_PREFIX = '{queue}';

export abstract class BaseQueue<TName extends keyof JobRegistry> extends Queue<
  JobRegistry[TName],
  null,
  TName,
  JobRegistry[TName],
  null,
  TName
> {
  readonly name: TName;

  constructor(name: TName, options = defaultQueueOptions) {
    super(name, {
      ...options,
      connection: redisConnOpt,
      prefix: QUEUE_PREFIX,
    });
    this.name = name;
  }

  dispatch(data: JobRegistry[TName], opts?: JobsOptions) {
    return this.add(this.name, data, opts);
  }

  async purge(force = false) {
    await this.obliterate({ force });
    await this.disconnect();
  }
}

export abstract class BaseWorker<TName extends keyof JobRegistry> extends Worker<
  JobRegistry[TName],
  null,
  TName
> {
  constructor(name: TName, options: WorkerOptions = defaultWorkerOptions) {
    super(
      name,
      async (job) => {
        const { upstream } = job.data;
        await withLogContext(async () => {
          const start = performance.now();
          logger.log('info', 'bull:job:started', { jobId: job.id, queue: name, upstream });

          try {
            await withOrmContext(() => this.processor(job));
            logger.log('info', 'bull:job:succeeded');
          } catch (error) {
            const remaining = (job.opts.attempts ?? 1) - job.attemptsStarted;
            logger.log(remaining <= 0 ? 'error' : 'warn', 'bull:job:failed', { error, remaining });
            throw error;
          } finally {
            logger.log('info', 'bull:job:completed', { duration: performance.now() - start });
          }
        });

        // NOTE BullMQ expects null as the return value when there is no meaningful result.
        return null;
      },
      {
        ...options,
        connection: redisConnOpt,
        prefix: QUEUE_PREFIX,
      },
    );

    this.on('failed', (job, error) =>
      logger.log('error', 'bull:worker:failed', { queue: name, jobId: job?.id, error }),
    );
    this.on('error', (error) => logger.log('error', 'bull:worker:error', { queue: name, error }));
    this.on('stalled', (jobId) =>
      logger.log('warn', 'bull:worker:stalled', { queue: name, jobId }),
    );
  }

  abstract processor(job: Job<JobRegistry[TName], null, TName>): Promise<void>;
}
