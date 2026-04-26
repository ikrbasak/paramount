import { afterAll, describe, expect, it, vi } from 'vitest';

import { logger } from '@/lib/logger';
import { SampleLogQueue, SampleLogQueueWorker } from '@/queues/sample-log';

describe('sample log queue', () => {
  const queue = new SampleLogQueue('SampleLog');
  const worker = new SampleLogQueueWorker('SampleLog');

  afterAll(async () => {
    await queue.drain();
    await queue.close();
    await worker.close();
  });

  it('should dispatch a job with the correct name and payload', async () => {
    const job = await queue.dispatch({ content: 'test message' });

    expect(job.name).toBe('SampleLog');
    expect(job.data.content).toBe('test message');
  });

  it('should dispatch a job with an upstream identifier', async () => {
    const job = await queue.dispatch({ content: 'with upstream', upstream: 42 });

    expect(job.data.upstream).toBe(42);
    expect(job.data.content).toBe('with upstream');
  });

  it('should log the content when the processor runs', async () => {
    const spy = vi.spyOn(logger, 'log');

    const job = await queue.dispatch({ content: 'log this' });
    await worker.processor(job);

    expect(spy).toHaveBeenCalledWith(
      'info',
      'sample:log:completed',
      expect.objectContaining({ content: 'log this' }),
    );

    spy.mockRestore();
  });
});
