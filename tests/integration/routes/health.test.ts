import { describe, expect, it, vi } from 'vitest';

import { cacheClient } from '@/cache/client';
import { APIRoute } from '@/constants/api-route';
import { HttpStatus } from '@/constants/http-status';
import { orm } from '@/database/connection';
import { UuidUtil } from '@/utils/uuid';

import { request } from '~/utils/request';

describe('application health checks', () => {
  it('should return 200 when the application and its dependencies are healthy', async () => {
    const { success, status } = await request({
      route: APIRoute.Health,
    });

    expect(success).toBeTruthy();
    expect(status).toBe(HttpStatus.Ok);
  });

  it('should return 404 when the request path does not exist', async () => {
    const { success, status } = await request({
      route: `${APIRoute.Health}/${UuidUtil.generate()}`,
    });

    expect(success).toBeFalsy();
    expect(status).toBe(HttpStatus.NotFound);
  });

  it('should return 500 when the database is unavailable during the health check', async () => {
    const spy = vi.spyOn(orm.em, 'execute').mockRejectedValue(new Error('DB unavailable'));

    const { success, status } = await request({
      route: APIRoute.Health,
    });

    expect(success).toBeFalsy();
    expect(status).toBe(HttpStatus.InternalServerError);

    spy.mockRestore();
  });

  it('should return 500 when the cache service is unavailable during the health check', async () => {
    const spy = vi.spyOn(cacheClient, 'ping').mockRejectedValue(new Error('Cache unavailable'));

    const { success, status } = await request({
      route: APIRoute.Health,
    });

    expect(success).toBeFalsy();
    expect(status).toBe(HttpStatus.InternalServerError);

    spy.mockRestore();
  });

  it('should return 500 when both the database and cache are unavailable during the health check', async () => {
    const dbSpy = vi.spyOn(orm.em, 'execute').mockRejectedValue(new Error('DB unavailable'));
    const cacheSpy = vi
      .spyOn(cacheClient, 'ping')
      .mockRejectedValue(new Error('Cache unavailable'));

    const { success, status } = await request({
      route: APIRoute.Health,
    });

    expect(success).toBeFalsy();
    expect(status).toBe(HttpStatus.InternalServerError);

    dbSpy.mockRestore();
    cacheSpy.mockRestore();
  });
});
