import type { MiddlewareHandler } from 'hono';

import { HttpStatus } from '@/constants/http-status';

type ResponseCacheCustomOptions = {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  private?: boolean;
  noTransform?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
  vary?: string[];
};

type ResponseCacheOptions = 'infinite' | 'revalidate' | 'never' | ResponseCacheCustomOptions;

type ResponseCachePreset = Extract<ResponseCacheOptions, string>;

const directives = (parts: Array<string | false | undefined>) => parts.filter(Boolean).join(', ');

const PRESET_CACHE_CONTROL: Record<ResponseCachePreset, string> = {
  infinite: 'public, max-age=604800, s-maxage=604800, immutable',
  revalidate: 'no-cache, must-revalidate, proxy-revalidate',
  never: 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

const PRESET_CDN_CACHE_CONTROL: Record<ResponseCachePreset, string> = {
  infinite: 'public, max-age=604800, immutable',
  revalidate: 'no-cache, must-revalidate',
  never: 'no-store',
};

const buildCacheControl = (opts: ResponseCacheCustomOptions): string =>
  directives([
    opts.private ? 'private' : 'public',
    opts.maxAge !== undefined && `max-age=${opts.maxAge}`,
    opts.sMaxAge !== undefined && `s-maxage=${opts.sMaxAge}`,
    opts.staleWhileRevalidate !== undefined &&
      `stale-while-revalidate=${opts.staleWhileRevalidate}`,
    opts.staleIfError !== undefined && `stale-if-error=${opts.staleIfError}`,
    opts.noTransform && 'no-transform',
    opts.mustRevalidate && 'must-revalidate',
    opts.proxyRevalidate && 'proxy-revalidate',
    opts.immutable && 'immutable',
  ]);

const buildCdnCacheControl = (opts: ResponseCacheCustomOptions): string | null => {
  if (opts.sMaxAge === undefined) {
    return null;
  }

  return directives([
    `max-age=${opts.sMaxAge}`,
    opts.staleWhileRevalidate !== undefined &&
      `stale-while-revalidate=${opts.staleWhileRevalidate}`,
    opts.staleIfError !== undefined && `stale-if-error=${opts.staleIfError}`,
    opts.immutable && 'immutable',
  ]);
};

const resolveVary = (opts: ResponseCacheCustomOptions): string | null => {
  const vary = opts.vary ?? ['Authorization'];
  return vary.length > 0 ? vary.join(', ') : null;
};

export const responseCache = (opts: ResponseCacheOptions): MiddlewareHandler => {
  const isPreset = typeof opts === 'string';
  const cacheControl = isPreset ? PRESET_CACHE_CONTROL[opts] : buildCacheControl(opts);
  const cdnCacheControl = isPreset ? PRESET_CDN_CACHE_CONTROL[opts] : buildCdnCacheControl(opts);
  let vary: string | null = null;
  if (isPreset && opts !== 'never') {
    vary = 'Authorization';
  } else if (!isPreset) {
    vary = resolveVary(opts);
  }
  const guardStatus = opts === 'infinite';

  return async (c, next) => {
    await next();

    if (
      guardStatus &&
      (c.res.status < (HttpStatus.Ok as number) ||
        c.res.status >= (HttpStatus.MultipleChoices as number))
    ) {
      c.header('Cache-Control', 'no-store');
      c.header('CDN-Cache-Control', 'no-store');
      return;
    }

    c.header('Cache-Control', cacheControl);

    if (cdnCacheControl) {
      c.header('CDN-Cache-Control', cdnCacheControl);
    }

    if (vary) {
      c.header('Vary', vary);
    }

    if (opts === 'never') {
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    }
  };
};
