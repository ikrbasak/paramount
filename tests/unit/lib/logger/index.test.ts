import { describe, expect, it, vi } from 'vitest';

import { logger, withLogContext } from '@/lib/logger';

describe('logger with async context propagation', () => {
  it('should expose log, audit, and flush methods', () => {
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.audit).toBe('function');
    expect(typeof logger.flush).toBe('function');
  });

  it('should accumulate .log calls inside withLogContext and flush at scope exit', async () => {
    const spy = vi.spyOn(logger, 'flush');

    await withLogContext(() => {
      logger.log('info', 'hono:req:context', { reqId: 'test-id', url: '/test', method: 'GET' });
      logger.log('info', 'hono:req:completed', { duration: 42 });
    });

    expect(spy).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });

  it('should flush with error flag when scope exits due to thrown error', async () => {
    const spy = vi.spyOn(logger, 'flush');

    await expect(
      withLogContext(() => {
        logger.log('info', 'hono:req:context', { reqId: 'err', url: '/fail', method: 'GET' });
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');

    expect(spy).toHaveBeenCalledWith(true);
    spy.mockRestore();
  });

  it('should emit immediately outside withLogContext', () => {
    const spy = vi.spyOn(logger, 'log');

    logger.log('error', 'config:env:failed', { issues: ['missing DB_URL'] });

    expect(spy).toHaveBeenCalledWith('error', 'config:env:failed', { issues: ['missing DB_URL'] });
    spy.mockRestore();
  });

  it('should isolate contexts across concurrent withLogContext calls', async () => {
    const flushSpy = vi.spyOn(logger, 'flush');

    await Promise.all([
      withLogContext(() => {
        logger.log('info', 'hono:req:context', { reqId: 'a', url: '/a', method: 'GET' });
      }),
      withLogContext(() => {
        logger.log('info', 'hono:req:context', { reqId: 'b', url: '/b', method: 'POST' });
      }),
    ]);

    expect(flushSpy).toHaveBeenCalledTimes(2);
    flushSpy.mockRestore();
  });

  it('should propagate context across async boundaries inside withLogContext', async () => {
    const spy = vi.spyOn(logger, 'flush');

    await withLogContext(async () => {
      logger.log('info', 'hono:req:context', { reqId: 'async', url: '/async', method: 'GET' });
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.log('info', 'hono:req:completed', { duration: 10 });
    });

    expect(spy).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });
});
