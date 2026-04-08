import type { Hono } from 'hono';
import qs from 'qs';

import { APIRouteVersion } from '@/constants/api-route';
import { server as s } from '@/server';

type ExtractDynamicPathParams<
  TRoute extends string,
  TVal = string | number,
> = TRoute extends `${string}:${infer Param}/${infer Rest}`
  ? Record<Param, TVal> & ExtractDynamicPathParams<`/${Rest}`>
  : TRoute extends `${string}:${infer Param}`
    ? Record<Param, TVal>
    : Record<never, never>;

type RouteInterpolationOptions<TRoute extends string, TParam = ExtractDynamicPathParams<TRoute>> = {
  route: TRoute;
} & (keyof TParam extends never ? { params?: never } : { params: TParam });

type RequestOptions<TRoute extends string> = {
  server?: Hono;
} & {
  body?: object;
  query?: object;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  prefix?: `/${string}`;
} & Omit<RequestInit, 'body' | 'method'> &
  RouteInterpolationOptions<TRoute>;

const interpolate = <TPath extends string>({
  route,
  params,
}: {
  route: TPath;
  params?: ExtractDynamicPathParams<TPath>;
}) => {
  let result: string = route;

  for (const key in params) {
    if (Object.hasOwn(params, key)) {
      const toReplace = `:${key}`;
      const value = params[key as keyof typeof params];
      // oxlint-disable-next-line typescript/restrict-template-expressions
      result = result.replaceAll(toReplace, `${value}`);
    }
  }

  return result;
};

export const request = async <TRoute extends `/${string}`>({
  server = s,
  params,
  route,
  body,
  query,
  method = 'GET',
  prefix = APIRouteVersion.V1,
  ...opts
}: RequestOptions<TRoute>) => {
  let path: string = route;

  if (params !== undefined) {
    path = interpolate<typeof route>({ route, params });
  }

  path = `${prefix}${path}?${qs.stringify(query, {
    skipNulls: true,
    arrayFormat: 'indices',
    encodeValuesOnly: false,
    allowEmptyArrays: false,
    strictNullHandling: true,
  })}`;

  const response = await server.request(path, {
    ...opts,
    body: JSON.stringify(body),
    method,
  });

  return {
    status: response.status,
    json: await response.json(),
    success: response.ok,
  };
};
