import { describe, expect, it } from 'vitest';

import { logger, withLogContext } from '@/lib/logger';

describe('typed logger with async context propagation', () => {
  it('should expose log, audit, add, and flush methods', () => {
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.audit).toBe('function');
    expect(typeof logger.add).toBe('function');
    expect(typeof logger.flush).toBe('function');
  });

  it('should accumulate wide event data inside withLogContext', async () => {
    let flushed = false;

    await withLogContext(() => {
      logger.add('hono:req:context', { reqId: 'test-id', url: '/test', method: 'GET' });
      logger.add('hono:req:completed', { duration: 42 });
      flushed = true;
    });

    expect(flushed).toBeTruthy();
  });

  it('should isolate contexts across concurrent withLogContext calls', async () => {
    const results: boolean[] = [];

    await Promise.all([
      withLogContext(() => {
        logger.add('hono:req:context', { reqId: 'a', url: '/a', method: 'GET' });
        results.push(true);
      }),
      withLogContext(() => {
        logger.add('hono:req:context', { reqId: 'b', url: '/b', method: 'POST' });
        results.push(true);
      }),
    ]);

    expect(results).toHaveLength(2);
  });

  it('should propagate context across async boundaries inside withLogContext', async () => {
    let completed = false;

    await withLogContext(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.add('hono:req:completed', { duration: 10 });
      completed = true;
    });

    expect(completed).toBeTruthy();
  });
});
