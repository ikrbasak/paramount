import { Hono } from 'hono';
import * as z from 'zod';

import { APIRoute } from '@/constants/api-route';
import { requestValidate } from '@/lib/hono/middlewares/request-validate';
import { responseCache } from '@/lib/hono/middlewares/response-cache';
import { HealthCheckService } from '@/services/health-check';

const healthRouter = new Hono().get(
  APIRoute.Health,
  requestValidate('query', z.object({})),
  responseCache('never'),
  async (c) => {
    const success = await HealthCheckService.check();

    return c.json({ success, ts: new Date() });
  },
);

export default healthRouter;
