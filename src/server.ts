import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { etag } from 'hono/etag';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { timeout } from 'hono/timeout';
import { timing } from 'hono/timing';
import { trimTrailingSlash } from 'hono/trailing-slash';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { env } from '@/configs/environment';
import { ErrorMessage } from '@/constants/error-message';
import { HttpStatus } from '@/constants/http-status';
import { withOrmContext } from '@/database/connection';
import { ErrorFormat, NotFoundError } from '@/lib/error';
import { logger, withLogContext } from '@/lib/logger';
import { routes } from '@/routes';
import { UuidUtil } from '@/utils/uuid';

export const server = new Hono({
  getPath: (req) => {
    const url = new URL(req.url);
    return url.pathname;
  },
})
  // ============================== the following middlewares are common for all routes
  .use(trimTrailingSlash())
  .use(requestId({ generator: () => UuidUtil.generate() }))
  .use(async (c, next) => {
    await withLogContext(async () => {
      const now = performance.now();
      const { url, method } = c.req;
      logger.log('info', 'hono:req:context', { reqId: c.get('requestId'), url, method });

      await next();
      logger.log('info', 'hono:req:completed', { duration: performance.now() - now });
    });
  })
  .use(
    cors({
      origin: env.SERVER_CORS_ALLOWED_ORIGIN,
      credentials: env.SERVER_CORS_ALLOW_CREDENTIALS,
    }),
  )
  .use(etag())
  .use(secureHeaders())
  .use(timing({ enabled: env.SERVER_ENABLE_TIMING_DEBUGGER }))
  .use(
    timeout(
      env.SERVER_TIMEOUT_MS,
      new HTTPException(HttpStatus.RequestTimeout, {
        message: ErrorMessage.Generic.RequestTimeout,
      }),
    ),
  )
  .use(
    bodyLimit({
      maxSize: env.SERVER_MAX_BODY_SIZE_KB,
    }),
  )
  .use(async (_c, next) => {
    await withOrmContext(next);
  })
  // ============================== the following are the error handlers
  .notFound((c) => {
    const { method, url } = c.req;

    throw new NotFoundError(ErrorMessage.Field.LabelNotFound('Requested resource'), {
      url,
      method,
    });
  })
  .onError((error, c) => {
    const { status, cause, stack, message } = ErrorFormat.format(error);

    if (status >= HttpStatus.InternalServerError) {
      logger.log('error', 'hono:req:failed', { message, stack, cause });
    } else {
      logger.log('debug', 'hono:req:failed', { message, stack, cause });
    }

    return c.json(
      {
        message,
        cause,
        stack: env.SERVER_ENABLE_ERROR_STACK ? stack : undefined,
      },
      // oxlint-disable-next-line no-unsafe-type-assertion
      status as ContentfulStatusCode,
    );
  })
  .route('/', routes);
