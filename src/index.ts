// oxlint-disable typescript/no-misused-promises, unicorn/no-process-exit
import { serve } from 'bun';

import { cacheClient } from '@/cache/client';
import { env } from '@/configs/environment';
import { orm } from '@/database/connection';
import { logger } from '@/lib/logger';
import { queues, workers } from '@/queues';
import { server } from '@/server';

// NOTE Disposers are pushed as resources come up and drained in reverse on shutdown.
// This way a partial init failure still cleans up everything that did start.
const disposers: Array<() => Promise<unknown>> = [
  async () => {
    try {
      await cacheClient.quit();
    } catch {
      cacheClient.disconnect();
    }
  },
];

let shuttingDown = false;
const shutdown = async (signal: string, error?: unknown) => {
  logger.info({ signal, error }, 'server:termination:requested');

  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  let exitCode = 0;
  for (const dispose of disposers.reverse()) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop
      await dispose();
    } catch (disposeError) {
      logger.error({ error: disposeError }, 'server:termination:disposer-failed');
      exitCode = 1;
    }
  }

  logger[exitCode === 0 ? 'info' : 'error']('server:termination:completed');
  process.exit(exitCode);
};

// signal handling
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);

// catch crashes
process.on('uncaughtException', (error) => shutdown('uncaughtException', error));
process.on('unhandledRejection', (error) => shutdown('unhandledRejection', error));

const initialize = async () => {
  await orm.connect();
  disposers.push(() => orm.close());

  Object.values(workers).map((w) => w.resume());
  disposers.push(async () => {
    await Promise.all(Object.values(workers).map((w) => w.pause(true)));
    await Promise.all(Object.values(workers).map((w) => w.close()));
  });

  await Promise.all(Object.values(queues).map((q) => q.resume()));
  disposers.push(async () => {
    await Promise.all(Object.values(queues).map((q) => q.pause()));
    await Promise.all(Object.values(queues).map((q) => q.close()));
  });
};

try {
  await initialize();
} catch (error) {
  logger.fatal({ error }, 'server:initialization:failed');
  await shutdown('initialization:failed', error);
  process.exit(1);
}

const app = serve({
  port: env.SERVER_PORT,
  development: false,
  fetch: server.fetch,
});
disposers.push(() => app.stop(true));

export default app;
