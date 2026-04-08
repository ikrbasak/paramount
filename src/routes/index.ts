import { Hono } from 'hono';

import { APIRouteVersion } from '@/constants/api-route';
import healthRouter from '@/routes/health';

export const routes = new Hono().basePath(APIRouteVersion.V1).route('/', healthRouter);
