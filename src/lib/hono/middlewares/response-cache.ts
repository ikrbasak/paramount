import type { MiddlewareHandler } from 'hono';

/** Default maximum TTL for cached responses (7 days in seconds). */
const DEFAULT_MAX_TTL = 604_800;

type ResponseCacheCustomOptions = {
  /** Browser cache lifetime in seconds (`max-age`). */
  maxAge?: number;
  /** CDN / shared-cache lifetime in seconds (`s-maxage`). */
  sMaxAge?: number;
  /** Seconds a stale response may be served while revalidating in the background. */
  staleWhileRevalidate?: number;
  /** Seconds a stale response may be served when the origin returns an error. */
  staleIfError?: number;
  /** Restrict caching to the browser only — prevents CDN storage. Defaults to `public`. */
  private?: boolean;
  /** Prevent intermediaries from altering the response (e.g. image compression). */
  noTransform?: boolean;
  /** Force the browser to revalidate once the response becomes stale. */
  mustRevalidate?: boolean;
  /** Force CDN / shared caches to revalidate once the response becomes stale. */
  proxyRevalidate?: boolean;
  /** Signal that the response body will never change — enables aggressive caching. */
  immutable?: boolean;
  /**
   * Request headers the response varies on. Sets the `Vary` response header so browsers
   * and CDNs cache separate variants per unique combination of these header values.
   *
   * Defaults to `['Authorization']`. Pass `[]` to omit the header entirely.
   *
   * **Note:** Query strings are always part of the cache key at the URL level. Varying on
   * query parameters requires CDN distribution-level configuration (CloudFront cache
   * policy / Cloudflare cache rules), not the `Vary` header.
   */
  vary?: string[];
};

/**
 * Preset or custom cache-control strategy for browser and CDN (CloudFront / Cloudflare).
 *
 * - `'infinite'` — cache for 7 days in browser + CDN (immutable). Only applied to 2xx
 *   responses — non-2xx responses receive `no-store` to prevent caching errors at the
 *   edge. Use for content-addressed assets (hashed filenames, versioned URLs).
 * - `'revalidate'` — always revalidate with the origin before serving. Browser and CDN
 *   may store the response but must check freshness on every request.
 * - `'never'` — no caching anywhere. Adds `Pragma` and `Expires` headers for
 *   legacy proxy compatibility.
 * - `ResponseCacheCustomOptions` — build a directive string from individual fields.
 *
 * **Middleware ordering:** this middleware sets headers *after* `await next()`. If another
 * middleware later in the chain also sets `Cache-Control`, its value wins. When using
 * per-route, ensure `responseCache` is the last middleware that touches cache headers.
 *
 * **CDN headers:** sets `CDN-Cache-Control` for Cloudflare edge-specific control.
 * CloudFront does not have a proprietary cache header — it reads `s-maxage` from the
 * standard `Cache-Control` header directly.
 *
 * **Vary:** presets that cache (`'infinite'`, `'revalidate'`) and custom options default
 * to `Vary: Authorization`. Pass `vary: []` in custom options to omit. Query string
 * variance is a CDN distribution-level concern, not controllable via `Vary`.
 */
type ResponseCacheOptions = 'infinite' | 'revalidate' | 'never' | ResponseCacheCustomOptions;

const DEFAULT_VARY = ['Authorization'];

const PRESET_CACHE_CONTROL = {
  infinite: `public, max-age=${DEFAULT_MAX_TTL}, s-maxage=${DEFAULT_MAX_TTL}, immutable`,
  revalidate: 'no-cache, must-revalidate, proxy-revalidate',
  never: 'no-store, no-cache, must-revalidate, proxy-revalidate',
} as const;

type NumericDirectiveKey = 'maxAge' | 'sMaxAge' | 'staleWhileRevalidate' | 'staleIfError';
type BooleanDirectiveKey = 'noTransform' | 'mustRevalidate' | 'proxyRevalidate' | 'immutable';

const NUMERIC_DIRECTIVES: Array<[NumericDirectiveKey, string]> = [
  ['maxAge', 'max-age'],
  ['sMaxAge', 's-maxage'],
  ['staleWhileRevalidate', 'stale-while-revalidate'],
  ['staleIfError', 'stale-if-error'],
];

const BOOLEAN_DIRECTIVES: Array<[BooleanDirectiveKey, string]> = [
  ['noTransform', 'no-transform'],
  ['mustRevalidate', 'must-revalidate'],
  ['proxyRevalidate', 'proxy-revalidate'],
  ['immutable', 'immutable'],
];

const buildCustomCacheControl = (opts: ResponseCacheCustomOptions): string => {
  const directives: string[] = [opts.private ? 'private' : 'public'];

  for (const [key, directive] of NUMERIC_DIRECTIVES) {
    if (opts[key] !== undefined) {
      directives.push(`${directive}=${opts[key]}`);
    }
  }

  for (const [key, directive] of BOOLEAN_DIRECTIVES) {
    if (opts[key]) {
      directives.push(directive);
    }
  }

  return directives.join(', ');
};

const buildCacheControl = (opts: ResponseCacheOptions): string => {
  if (typeof opts === 'string') {
    return PRESET_CACHE_CONTROL[opts];
  }

  return buildCustomCacheControl(opts);
};

const PRESET_CDN_CACHE_CONTROL = {
  infinite: `public, max-age=${DEFAULT_MAX_TTL}, immutable`,
  revalidate: 'no-cache, must-revalidate',
  never: 'no-store',
} as const;

/**
 * Builds the `CDN-Cache-Control` header value for Cloudflare edge caching.
 * Uses `max-age` (not `s-maxage`) because `CDN-Cache-Control` applies exclusively
 * to shared caches — `s-maxage` would be redundant.
 *
 * CloudFront does not read this header — it relies on `s-maxage` from `Cache-Control`.
 *
 * Returns `null` when no CDN-specific override is needed (custom options without `sMaxAge`).
 */
const buildCdnCacheControl = (opts: ResponseCacheOptions): string | null => {
  if (typeof opts === 'string') {
    return PRESET_CDN_CACHE_CONTROL[opts];
  }

  if (opts.sMaxAge === undefined) {
    return null;
  }

  const directives: string[] = [`max-age=${opts.sMaxAge}`];

  for (const [key, directive] of NUMERIC_DIRECTIVES) {
    if (key !== 'maxAge' && key !== 'sMaxAge' && opts[key] !== undefined) {
      directives.push(`${directive}=${opts[key]}`);
    }
  }

  for (const [key, directive] of BOOLEAN_DIRECTIVES) {
    if (opts[key]) {
      directives.push(directive);
    }
  }

  return directives.join(', ');
};

const resolveVary = (opts: ResponseCacheOptions): string | null => {
  if (opts === 'never') {
    return null;
  }

  if (opts === 'infinite' || opts === 'revalidate') {
    return DEFAULT_VARY.join(', ');
  }

  const vary = opts.vary ?? DEFAULT_VARY;
  return vary.length > 0 ? vary.join(', ') : null;
};

/**
 * Hono middleware that sets `Cache-Control`, `CDN-Cache-Control`, and `Vary` headers
 * on responses. All directive strings are computed once at creation time, not per-request.
 *
 * The `'infinite'` preset only caches 2xx responses — errors fall back to `no-store`
 * to prevent CDN-cached error pages requiring manual invalidation.
 *
 * @example
 * ```ts
 * app.get('/assets/*', responseCache('infinite'), handler);
 * app.get('/me', responseCache('never'), handler);
 * app.get('/feed', responseCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 120 }), handler);
 * app.get('/public', responseCache({ maxAge: 300, vary: [] }), handler);
 * ```
 */
export const responseCache = (opts: ResponseCacheOptions): MiddlewareHandler => {
  const cacheControl = buildCacheControl(opts);
  const cdnCacheControl = buildCdnCacheControl(opts);
  const vary = resolveVary(opts);
  const guardStatus = opts === 'infinite';

  return async (c, next) => {
    await next();

    if (guardStatus && (c.res.status < 200 || c.res.status >= 300)) {
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
