import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { describe, expect, it } from 'vitest';

import { HttpStatus } from '@/constants/http-status';
import { responseCache } from '@/lib/hono/middlewares/response-cache';

const createApp = (
  opts: Parameters<typeof responseCache>[0],
  status: ContentfulStatusCode = HttpStatus.Ok as ContentfulStatusCode,
) => {
  const app = new Hono();
  app.get('/test', responseCache(opts), (c) => c.json({ ok: true }, status));
  return app;
};

const header = (res: Response, name: string) => res.headers.get(name);

describe('response cache middleware', () => {
  describe('infinite preset', () => {
    const app = createApp('infinite');

    it('should set immutable public cache headers with a 7-day lifetime', async () => {
      const res = await app.request('/test');

      expect(res.status).toBe(HttpStatus.Ok);
      expect(header(res, 'Cache-Control')).toBe(
        'public, max-age=604800, s-maxage=604800, immutable',
      );
    });

    it('should set CDN-Cache-Control for Cloudflare edge caching', async () => {
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBe('public, max-age=604800, immutable');
    });

    it('should set Vary header to Authorization', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBe('Authorization');
    });

    it('should not set legacy no-cache headers', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Pragma')).toBeNull();
      expect(header(res, 'Expires')).toBeNull();
    });

    it('should fall back to no-store when response status is not 2xx', async () => {
      const app = createApp('infinite', HttpStatus.InternalServerError as ContentfulStatusCode);
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('no-store');
      expect(header(res, 'CDN-Cache-Control')).toBe('no-store');
    });

    it('should fall back to no-store for 4xx responses', async () => {
      const app = createApp('infinite', HttpStatus.NotFound as ContentfulStatusCode);
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('no-store');
    });

    it('should cache 201 responses normally', async () => {
      const app = createApp('infinite', HttpStatus.Created as ContentfulStatusCode);
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe(
        'public, max-age=604800, s-maxage=604800, immutable',
      );
    });
  });

  describe('revalidate preset', () => {
    const app = createApp('revalidate');

    it('should force revalidation on browser and CDN', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('no-cache, must-revalidate, proxy-revalidate');
    });

    it('should set CDN-Cache-Control for Cloudflare', async () => {
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBe('no-cache, must-revalidate');
    });

    it('should set Vary header to Authorization', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBe('Authorization');
    });

    it('should not set legacy no-cache headers', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Pragma')).toBeNull();
      expect(header(res, 'Expires')).toBeNull();
    });
  });

  describe('never preset', () => {
    const app = createApp('never');

    it('should disable all caching', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
    });

    it('should set CDN-Cache-Control to no-store', async () => {
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBe('no-store');
    });

    it('should set legacy no-cache headers for proxy compatibility', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Pragma')).toBe('no-cache');
      expect(header(res, 'Expires')).toBe('0');
    });

    it('should not set Vary header', async () => {
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBeNull();
    });
  });

  describe('custom options', () => {
    it('should default to public scope', async () => {
      const app = createApp({ maxAge: 60 });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('public, max-age=60');
    });

    it('should use private scope when specified', async () => {
      const app = createApp({ private: true, maxAge: 120 });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('private, max-age=120');
    });

    it('should include s-maxage for CDN lifetime', async () => {
      const app = createApp({ maxAge: 60, sMaxAge: 300 });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('public, max-age=60, s-maxage=300');
    });

    it('should include stale-while-revalidate and stale-if-error', async () => {
      const app = createApp({ maxAge: 60, staleWhileRevalidate: 120, staleIfError: 3600 });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe(
        'public, max-age=60, stale-while-revalidate=120, stale-if-error=3600',
      );
    });

    it('should include boolean directives when enabled', async () => {
      const app = createApp({
        maxAge: 0,
        noTransform: true,
        mustRevalidate: true,
        proxyRevalidate: true,
        immutable: true,
      });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe(
        'public, max-age=0, no-transform, must-revalidate, proxy-revalidate, immutable',
      );
    });

    it('should omit boolean directives when not set', async () => {
      const app = createApp({
        noTransform: false,
        mustRevalidate: false,
        proxyRevalidate: false,
        immutable: false,
      });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('public');
    });

    it('should allow max-age of zero for immediate staleness', async () => {
      const app = createApp({ maxAge: 0, sMaxAge: 0 });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe('public, max-age=0, s-maxage=0');
    });

    it('should combine all options together', async () => {
      const app = createApp({
        private: true,
        maxAge: 30,
        sMaxAge: 600,
        staleWhileRevalidate: 60,
        staleIfError: 1800,
        noTransform: true,
        mustRevalidate: true,
        proxyRevalidate: true,
        immutable: true,
      });
      const res = await app.request('/test');

      expect(header(res, 'Cache-Control')).toBe(
        'private, max-age=30, s-maxage=600, stale-while-revalidate=60, stale-if-error=1800, no-transform, must-revalidate, proxy-revalidate, immutable',
      );
    });

    it('should not set legacy no-cache headers', async () => {
      const app = createApp({ maxAge: 60 });
      const res = await app.request('/test');

      expect(header(res, 'Pragma')).toBeNull();
      expect(header(res, 'Expires')).toBeNull();
    });
  });

  describe('cdn-cache-control header', () => {
    it('should set CDN-Cache-Control when sMaxAge is provided', async () => {
      const app = createApp({ maxAge: 60, sMaxAge: 300 });
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBe('max-age=300');
    });

    it('should include stale directives in CDN-Cache-Control', async () => {
      const app = createApp({
        sMaxAge: 300,
        staleWhileRevalidate: 60,
        staleIfError: 1800,
        immutable: true,
      });
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBe(
        'max-age=300, stale-while-revalidate=60, stale-if-error=1800, immutable',
      );
    });

    it('should not set CDN-Cache-Control when sMaxAge is absent in custom options', async () => {
      const app = createApp({ maxAge: 60 });
      const res = await app.request('/test');

      expect(header(res, 'CDN-Cache-Control')).toBeNull();
    });
  });

  describe('vary header', () => {
    it('should default to Authorization for custom options', async () => {
      const app = createApp({ maxAge: 60 });
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBe('Authorization');
    });

    it('should allow custom vary headers', async () => {
      const app = createApp({ maxAge: 60, vary: ['Authorization', 'Accept-Language'] });
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBe('Authorization, Accept-Language');
    });

    it('should omit Vary when vary is an empty array', async () => {
      const app = createApp({ maxAge: 60, vary: [] });
      const res = await app.request('/test');

      expect(header(res, 'Vary')).toBeNull();
    });
  });
});
