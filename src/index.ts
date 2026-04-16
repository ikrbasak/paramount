// oxlint-disable typescript/no-misused-promises, unicorn/no-process-exit
import { serve } from 'bun';

import { cacheClient } from '@/cache/client';
import { env } from '@/configs/environment';
import { orm } from '@/database/connection';
import { logger } from '@/lib/logger';
import { queues, workers } from '@/queues';
import { server } from '@/server';

const initialize = async () => {
  await orm.connect();
  Object.values(workers).map((w) => w.resume());
  await Promise.all(Object.values(queues).map((q) => q.resume()));
};

await initialize();

const app = serve({
  port: env.SERVER_PORT,
  development: false,
  fetch: server.fetch,
});

let shuttingDown = false;
const shutdown = async (signal: string, error?: unknown) => {
  logger.info({ signal, error }, 'server:termination:requested');

  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    await app.stop(true);
    await Promise.all(Object.values(workers).map((w) => w.pause(true)));
    await Promise.all(Object.values(queues).map((q) => q.pause()));
    await orm.close();
    await cacheClient.quit().catch(() => cacheClient.disconnect());

    logger.error('server:termination:success');
  } catch (error) {
    logger.error({ error }, 'server:termination:error');
    process.exit(1);
  }

  process.exit(0);
};

// signal handling
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);

// catch crashes
process.on('uncaughtException', (error) => shutdown('uncaughtException', error));
process.on('unhandledRejection', (error) => shutdown('unhandledRejection', error));

export default app;
