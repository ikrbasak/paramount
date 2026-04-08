import { Hono } from 'hono';
import * as z from 'zod';

import { APIRoute } from '@/constants/api-route';
import { requestValidate } from '@/lib/hono/middlewares/request-validate';
import { HealthCheckService } from '@/services/health-check';

const healthRouter = new Hono().get(
  APIRoute.Health,
  requestValidate('query', z.object({})),
  async (c) => {
    const success = await HealthCheckService.check();

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json({ success, ts: new Date() });
  },
);

export default healthRouter;
