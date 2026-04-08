import { describe, expect, it, vi } from 'vitest';

import { logger, withLogContext } from '@/lib/logger';

describe('structured logger with async context propagation', () => {
  it('should expose standard pino log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should include a correlationId when logging inside withLogContext', async () => {
    const spy = vi.fn();

    await withLogContext(() => {
      const bindings = logger.bindings();
      spy(bindings);
    });

    expect(spy).toHaveBeenCalledOnce();
    const bindings = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(bindings).toHaveProperty('correlationId');
    expect(typeof bindings.correlationId).toBe('string');
  });

  it('should not include a correlationId when logging outside withLogContext', () => {
    const bindings = logger.bindings();

    expect(bindings).not.toHaveProperty('correlationId');
  });

  it('should isolate correlationIds across concurrent contexts', async () => {
    const ids: string[] = [];

    await Promise.all([
      withLogContext(() => {
        ids.push(logger.bindings().correlationId as string);
      }),
      withLogContext(() => {
        ids.push(logger.bindings().correlationId as string);
      }),
    ]);

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('should propagate context across async boundaries inside withLogContext', async () => {
    let correlationId: string | undefined;

    await withLogContext(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      correlationId = logger.bindings().correlationId as string;
    });

    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe('string');
  });
});
