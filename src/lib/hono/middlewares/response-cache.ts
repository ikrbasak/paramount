import type { MiddlewareHandler } from 'hono';

/** @description Default maximum TTL for cached responses (7 days in seconds). */
const DEFAULT_MAX_TTL = 604_800;

/**
 * @description Custom cache-control directive options for fine-grained control.
 *
 * @property {number} [maxAge] - Browser cache lifetime in seconds (`max-age`).
 * @property {number} [sMaxAge] - CDN / shared-cache lifetime in seconds (`s-maxage`).
 * @property {number} [staleWhileRevalidate] - Seconds a stale response may be served while revalidating in the background.
 * @property {number} [staleIfError] - Seconds a stale response may be served when the origin returns an error.
 * @property {boolean} [private] - Restrict caching to the browser only — prevents CDN storage. Defaults to `public`.
 * @property {boolean} [noTransform] - Prevent intermediaries from altering the response (e.g. image compression).
 * @property {boolean} [mustRevalidate] - Force the browser to revalidate once the response becomes stale.
 * @property {boolean} [proxyRevalidate] - Force CDN / shared caches to revalidate once the response becomes stale.
 * @property {boolean} [immutable] - Signal that the response body will never change — enables aggressive caching.
 * @property {string[]} [vary] - Request headers the response varies on. Sets the `Vary` response header so browsers
 *   and CDNs cache separate variants per unique combination of these header values.
 *   Defaults to `['Authorization']`. Pass `[]` to omit the header entirely.
 *   Query strings are always part of the cache key at the URL level — varying on query
 *   parameters requires CDN distribution-level configuration (CloudFront cache policy /
 *   Cloudflare cache rules), not the `Vary` header.
 */
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

/**
 * @description Preset or custom cache-control strategy for browser and CDN (CloudFront / Cloudflare).
 *
 * @see {@link ResponseCacheCustomOptions} for custom directive fields.
 *
 * @remarks
 * **Presets:**
 * - `'infinite'` — cache for 7 days in browser + CDN (immutable). Only applied to 2xx
 *   responses — non-2xx responses receive `no-store` to prevent caching errors at the
 *   edge. Use for content-addressed assets (hashed filenames, versioned URLs).
 * - `'revalidate'` — always revalidate with the origin before serving. Browser and CDN
 *   may store the response but must check freshness on every request.
 * - `'never'` — no caching anywhere. Adds `Pragma` and `Expires` headers for
 *   legacy proxy compatibility.
 *
 * **Middleware ordering:** this middleware sets headers after `await next()`, so it
 * must be the first middleware in the per-route chain. In the onion model the first
 * middleware on the request path executes last on the response path — placing
 * `responseCache` first guarantees it has the final say on cache headers.
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

/** @description Default request headers to vary cached responses on. */
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

/**
 * @description Appends matching numeric and boolean directives from custom options
 * into the given directives array.
 * @param {string[]} directives - Mutable array to append directives to.
 * @param {ResponseCacheCustomOptions} opts - Custom cache options to read from.
 * @param {Set<NumericDirectiveKey>} [skipNumeric] - Numeric keys to exclude.
 */
const appendDirectives = (
  directives: string[],
  opts: ResponseCacheCustomOptions,
  skipNumeric?: Set<NumericDirectiveKey>,
): void => {
  for (const [key, directive] of NUMERIC_DIRECTIVES) {
    if (!skipNumeric?.has(key) && opts[key] !== undefined) {
      directives.push(`${directive}=${opts[key]}`);
    }
  }

  for (const [key, directive] of BOOLEAN_DIRECTIVES) {
    if (opts[key]) {
      directives.push(directive);
    }
  }
};

/**
 * @description Builds a `Cache-Control` header value from custom options.
 * @param {ResponseCacheCustomOptions} opts - Custom cache options.
 * @returns {string} The formatted `Cache-Control` directive string.
 */
const buildCustomCacheControl = (opts: ResponseCacheCustomOptions): string => {
  const directives: string[] = [opts.private ? 'private' : 'public'];
  appendDirectives(directives, opts);
  return directives.join(', ');
};

/**
 * @description Resolves the `Cache-Control` header value for any option variant.
 * @param {ResponseCacheOptions} opts - Preset string or custom options.
 * @returns {string} The formatted `Cache-Control` directive string.
 */
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
 * @description Builds the `CDN-Cache-Control` header value for Cloudflare edge caching.
 * Uses `max-age` (not `s-maxage`) because `CDN-Cache-Control` applies exclusively
 * to shared caches — `s-maxage` would be redundant.
 * CloudFront does not read this header — it relies on `s-maxage` from `Cache-Control`.
 * @param {ResponseCacheOptions} opts - Preset string or custom options.
 * @returns {string | null} The CDN directive string, or `null` when no override is needed.
 */
const buildCdnCacheControl = (opts: ResponseCacheOptions): string | null => {
  if (typeof opts === 'string') {
    return PRESET_CDN_CACHE_CONTROL[opts];
  }

  if (opts.sMaxAge === undefined) {
    return null;
  }

  const directives: string[] = [`max-age=${opts.sMaxAge}`];
  appendDirectives(directives, opts, new Set(['maxAge', 'sMaxAge']));
  return directives.join(', ');
};

/**
 * @description Resolves the `Vary` header value. Defaults to `Authorization` for cacheable
 * presets and custom options. Returns `null` for `'never'` or when `vary` is `[]`.
 * @param {ResponseCacheOptions} opts - Preset string or custom options.
 * @returns {string | null} The `Vary` header value, or `null` to omit.
 */
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
 * @description Hono middleware that sets `Cache-Control`, `CDN-Cache-Control`, and `Vary`
 * headers on responses. All directive strings are computed once at creation time, not
 * per-request. The `'infinite'` preset only caches 2xx responses — errors fall back to
 * `no-store` to prevent CDN-cached error pages requiring manual invalidation.
 * @param {ResponseCacheOptions} opts - Preset string or custom cache options.
 * @returns {MiddlewareHandler} Hono middleware handler.
 * @example
 * // responseCache must be first — it sets headers last in the onion model
 * app.get('/assets/*', responseCache('infinite'), validate, handler);
 * app.get('/me', responseCache('never'), validate, handler);
 * app.get('/feed', responseCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 120 }), handler);
 * app.get('/public', responseCache({ maxAge: 300, vary: [] }), handler);
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
