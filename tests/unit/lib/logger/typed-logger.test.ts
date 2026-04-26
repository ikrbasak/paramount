import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { TypedLogger, type LogContextStore } from '@/lib/logger/typed-logger';

const createBaseLogger = () => pino({ level: 'trace', enabled: false });
const noStore = (): LogContextStore | undefined => undefined;

const createStore = (): LogContextStore => ({
  logger: createBaseLogger().child({ correlationId: 'test-corr-id' }),
  events: [],
});

describe('typed logger', () => {
  describe('.log outside ALS', () => {
    it('should emit immediately via base logger', () => {
      const base = createBaseLogger();
      const spy = vi.spyOn(base, 'error');
      const typed = new TypedLogger(base, noStore);

      typed.log('error', 'redis:cache:error', { error: 'conn refused' });

      expect(spy).toHaveBeenCalledWith({ error: 'conn refused' }, 'redis:cache:error');
      spy.mockRestore();
    });

    it('should emit no-data keys without data argument', () => {
      const base = createBaseLogger();
      const spy = vi.spyOn(base, 'info');
      const typed = new TypedLogger(base, noStore);

      typed.log('info', 'bull:job:succeeded');

      expect(spy).toHaveBeenCalledWith('bull:job:succeeded');
      spy.mockRestore();
    });
  });

  describe('.log inside ALS', () => {
    it('should accumulate events into the wide event store', () => {
      const store = createStore();
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:context', { reqId: 'r1', url: '/test', method: 'GET' });
      typed.log('info', 'hono:req:completed', { duration: 42 });

      expect(store.events).toHaveLength(2);
      expect(store.events[0]).toMatchObject({
        key: 'hono:req:context',
        level: 'info',
        reqId: 'r1',
        url: '/test',
        method: 'GET',
      });
      expect(store.events[1]).toMatchObject({
        key: 'hono:req:completed',
        level: 'info',
        duration: 42,
      });
    });

    it('should store ts as epoch milliseconds on each event', () => {
      const store = createStore();
      const typed = new TypedLogger(createBaseLogger(), () => store);
      const before = Date.now();

      typed.log('debug', 'hono:req:completed', { duration: 1 });

      const after = Date.now();
      const ts = store.events[0]?.ts;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('should preserve the level on each accumulated event', () => {
      const store = createStore();
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('warn', 'bull:job:failed', { error: 'timeout', remaining: 0 });
      typed.log('debug', 'hono:req:completed', { duration: 5 });

      expect(store.events[0]?.level).toBe('warn');
      expect(store.events[1]?.level).toBe('debug');
    });

    it('should not emit immediately by default', () => {
      const store = createStore();
      const spy = vi.spyOn(store.logger, 'info');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:context', { reqId: 'r1', url: '/u', method: 'POST' });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should accumulate no-data keys with only key and level', () => {
      const store = createStore();
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'bull:job:succeeded');

      expect(store.events).toHaveLength(1);
      expect(store.events[0]).toMatchObject({ key: 'bull:job:succeeded', level: 'info' });
    });
  });

  describe('.log with { immediate: true }', () => {
    it('should both accumulate and emit immediately', () => {
      const store = createStore();
      const spy = vi.spyOn(store.logger, 'error');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('error', 'hono:req:failed', { message: 'boom', stack: 's' }, { immediate: true });

      expect(store.events).toHaveLength(1);
      expect(store.events[0]).toMatchObject({ key: 'hono:req:failed', message: 'boom' });
      expect(spy).toHaveBeenCalledWith({ message: 'boom', stack: 's' }, 'hono:req:failed');
      spy.mockRestore();
    });

    it('should emit at the specified level when immediate', () => {
      const store = createStore();
      const warnSpy = vi.spyOn(store.logger, 'warn');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('warn', 'bull:job:failed', { error: 'retry', remaining: 2 }, { immediate: true });

      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });
  });

  describe('.audit', () => {
    it('should emit immediately at info level with audit marker', () => {
      const base = createBaseLogger();
      const spy = vi.spyOn(base, 'info');
      const typed = new TypedLogger(base, noStore);

      typed.audit('sample:audit', { message: 'user action' });

      expect(spy).toHaveBeenCalledWith({ message: 'user action', audit: true }, 'sample:audit');
      spy.mockRestore();
    });

    it('should use ALS child logger when inside context', () => {
      const store = createStore();
      const spy = vi.spyOn(store.logger, 'info');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.audit('sample:audit', { message: 'tracked' });

      expect(spy).toHaveBeenCalledWith({ message: 'tracked', audit: true }, 'sample:audit');
      spy.mockRestore();
    });
  });

  describe('.flush', () => {
    it('should emit all accumulated events as a single wide:event log', () => {
      const store = createStore();
      const spy = vi.spyOn(store.logger, 'info');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:context', { reqId: 'r1', url: '/x', method: 'GET' });
      typed.log('info', 'hono:req:completed', { duration: 10 });
      typed.flush();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ key: 'hono:req:context', reqId: 'r1' }),
            expect.objectContaining({ key: 'hono:req:completed', duration: 10 }),
          ]),
        }),
        'wide:event',
      );
      spy.mockRestore();
    });

    it('should emit at info level on success', () => {
      const store = createStore();
      const infoSpy = vi.spyOn(store.logger, 'info');
      const errorSpy = vi.spyOn(store.logger, 'error');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:completed', { duration: 5 });
      typed.flush(false);

      expect(infoSpy).toHaveBeenCalledOnce();
      expect(errorSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should emit at error level when flushed with error', () => {
      const store = createStore();
      const infoSpy = vi.spyOn(store.logger, 'info');
      const errorSpy = vi.spyOn(store.logger, 'error');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:context', { reqId: 'r1', url: '/err', method: 'GET' });
      typed.flush(true);

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should clear the event store after flushing', () => {
      const store = createStore();
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.log('info', 'hono:req:completed', { duration: 1 });
      typed.flush();

      expect(store.events).toHaveLength(0);
    });

    it('should not emit when there are no accumulated events', () => {
      const store = createStore();
      const spy = vi.spyOn(store.logger, 'info');
      const typed = new TypedLogger(createBaseLogger(), () => store);

      typed.flush();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should not emit when outside ALS context', () => {
      const base = createBaseLogger();
      const spy = vi.spyOn(base, 'info');
      const typed = new TypedLogger(base, noStore);

      typed.flush();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
