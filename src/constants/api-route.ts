export const APIRoute = {
  Health: '/health',
} as const satisfies Record<string, string>;

export const APIRouteVersion = {
  V1: '/api/v1',
} as const satisfies Record<`V${string}`, `/api/v${string}`>;
