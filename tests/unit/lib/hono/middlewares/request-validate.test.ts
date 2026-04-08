import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { HttpStatus } from '@/constants/http-status';
import { CustomZodError } from '@/lib/error';
import { requestValidate } from '@/lib/hono/middlewares/request-validate';

const createApp = () => {
  const app = new Hono();

  app.post(
    '/test',
    requestValidate(
      'json',
      z.object({
        name: z.string().min(1),
        age: z.number().int().positive(),
      }),
    ),
    (c) => c.json({ ok: true }),
  );

  app.get('/search', requestValidate('query', z.object({ q: z.string().min(1) })), (c) =>
    c.json({ q: c.req.query('q') }),
  );

  // Catch CustomZodError and return structured response for assertions.
  app.onError((err, c) => {
    if (err instanceof CustomZodError) {
      return c.json(err.toJSON(), err.status as ContentfulStatusCode);
    }
    return c.json({ message: 'unexpected' }, HttpStatus.InternalServerError);
  });

  return app;
};

describe('request validation middleware', () => {
  const app = createApp();

  it('should pass valid json body through to the handler', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 30 }),
    });

    expect(res.status).toBe(HttpStatus.Ok);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('should throw CustomZodError with BadRequest for invalid json body', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', age: -5 }),
    });

    const body = (await res.json()) as { status: number; cause: { target: string } };

    expect(res.status).toBe(HttpStatus.BadRequest);
    expect(body.status).toBe(HttpStatus.BadRequest);
    expect(body.cause.target).toBe('json');
  });

  it('should throw CustomZodError when required fields are missing', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const body = (await res.json()) as { status: number; cause: { target: string } };

    expect(res.status).toBe(HttpStatus.BadRequest);
    expect(body.cause.target).toBe('json');
  });

  it('should validate query parameters', async () => {
    const res = await app.request('/search?q=hello');

    expect(res.status).toBe(HttpStatus.Ok);
    expect(await res.json()).toEqual({ q: 'hello' });
  });

  it('should reject invalid query parameters', async () => {
    const res = await app.request('/search?q=');

    const body = (await res.json()) as { status: number; cause: { target: string } };

    expect(res.status).toBe(HttpStatus.BadRequest);
    expect(body.cause.target).toBe('query');
  });
});
