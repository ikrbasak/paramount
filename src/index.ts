import { env } from '@/configs/environment';
import { orm } from '@/database/connection';
import { queues, workers } from '@/queues';
import { server } from '@/server';

const initialize = async () => {
  await orm.connect();
  Object.values(workers).map((w) => w.resume());
  await Promise.all(Object.values(queues).map((q) => q.resume()));
};

await initialize();

const app = Bun.serve({
  port: env.SERVER_PORT,
  development: false,
  fetch: server.fetch,
});

export default app;
