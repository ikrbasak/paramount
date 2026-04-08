import { afterAll, describe, expect, it, vi } from 'vitest';

import { BaseQueue, BaseWorker } from '@/lib/queue';
import type { JobRegistry } from '@/lib/queue/types';

class TestQueue extends BaseQueue<'SampleLog'> {
  constructor() {
    super('SampleLog');
  }
}

class TestWorker extends BaseWorker<'SampleLog'> {
  processor = vi.fn().mockResolvedValue(null);

  constructor() {
    super('SampleLog');
  }
}

describe('base queue and worker abstractions', () => {
  const queue = new TestQueue();
  const worker = new TestWorker();

  afterAll(async () => {
    await queue.drain();
    await queue.close();
    await worker.close();
  });

  describe('baseQueue', () => {
    it('should store the queue name', () => {
      expect(queue.name).toBe('SampleLog');
    });

    it('should dispatch a job via the add method', async () => {
      const payload: JobRegistry['SampleLog'] = {
        content: 'hello world',
      };
      const job = await queue.dispatch(payload);

      expect(job).toBeDefined();
      expect(job.name).toBe('SampleLog');
      expect(job.data).toEqual(payload);
    });

    it('should forward job options when dispatching', async () => {
      const job = await queue.dispatch({ content: 'delayed message' }, { delay: 5000 });

      expect(job.opts.delay).toBe(5000);
    });

    it('should drain queued jobs without error', async () => {
      await queue.dispatch({ content: 'drain me' });
      await queue.drain();

      const count = await queue.getJobCounts();

      expect(count.waiting).toBe(0);
    });
  });

  describe('baseWorker', () => {
    it('should store the worker name', () => {
      expect(worker.name).toBe('SampleLog');
    });
  });
});
