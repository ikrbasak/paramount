# Response Cache Middleware

Source: `src/lib/hono/middlewares/response-cache.ts`

Hono middleware setting `Cache-Control`, `CDN-Cache-Control`, and `Vary` headers. Values computed once at creation time, not per-request.

## Usage

```ts
import { responseCache } from '@/lib/hono/middlewares/response-cache';

app.get('/assets/*', responseCache('infinite'), handler);
app.get('/health', responseCache('never'), handler);
app.get('/feed', responseCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 120 }), handler);
```

## Ordering

`responseCache` sets headers after `await next()`. Place it **first** in per-route chain so it has final say on cache headers.

```ts
// correct — first in chain, sets headers last
app.get('/data', responseCache('infinite'), requestValidate('query', schema), handler);
```

## Presets

**`'infinite'`**: `Cache-Control: public, max-age=604800, s-maxage=604800, immutable`. 7-day browser + CDN cache. 2xx guard: non-2xx responses get `no-store` to prevent caching errors at edge. Use for content-addressed assets (hashed filenames, versioned URLs).

**`'revalidate'`**: `Cache-Control: no-cache, must-revalidate, proxy-revalidate`. Forces origin check every request. Use for unpredictably changing data benefiting from conditional requests (304).

**`'never'`**: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` + `Pragma: no-cache` + `Expires: 0`. No caching. Use for sensitive data, health checks.

All presets (except `'never'`) set `Vary: Authorization`.

## Custom options

| Option                 | Type       | HTTP Directive           | Description                                       |
| ---------------------- | ---------- | ------------------------ | ------------------------------------------------- |
| `maxAge`               | `number`   | `max-age`                | Browser cache lifetime (seconds)                  |
| `sMaxAge`              | `number`   | `s-maxage`               | CDN/shared cache lifetime (seconds)               |
| `staleWhileRevalidate` | `number`   | `stale-while-revalidate` | Serve stale while revalidating                    |
| `staleIfError`         | `number`   | `stale-if-error`         | Serve stale on origin error                       |
| `private`              | `boolean`  | `private`/`public`       | Browser only, no CDN (default: `false`)           |
| `noTransform`          | `boolean`  | `no-transform`           | Prevent intermediary alterations                  |
| `mustRevalidate`       | `boolean`  | `must-revalidate`        | Browser must revalidate when stale                |
| `proxyRevalidate`      | `boolean`  | `proxy-revalidate`       | CDN must revalidate when stale                    |
| `immutable`            | `boolean`  | `immutable`              | Body never changes                                |
| `vary`                 | `string[]` | `Vary`                   | Headers to vary on (default: `['Authorization']`) |

## CDN behavior

- `CDN-Cache-Control`: read by Cloudflare (takes precedence over `s-maxage`). Ignored by CloudFront (reads `s-maxage` from `Cache-Control` directly).
- `CDN-Cache-Control` emitted for custom options only when `sMaxAge` is provided.
- `Vary: []` to suppress Vary header. Query string variance is CDN distribution-level config.
