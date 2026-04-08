import { describe, expect, it, vi } from 'vitest';

import { cacheClient } from '@/cache/client';
import { ErrorMessage } from '@/constants/error-message';
import { HttpStatus } from '@/constants/http-status';
import { orm } from '@/database/connection';
import { CustomError } from '@/lib/error';
import { HealthCheckService } from '@/services/health-check';

describe('health check service', () => {
  it('should return true when database and cache are healthy', async () => {
    const result = await HealthCheckService.check();

    expect(result).toBeTruthy();
  });

  it('should throw when the database is unavailable', async () => {
    const spy = vi.spyOn(orm.em, 'execute').mockRejectedValue(new Error('DB down'));

    await expect(HealthCheckService.check()).rejects.toThrow('DB down');

    spy.mockRestore();
  });

  it('should throw when the cache is unavailable', async () => {
    const spy = vi.spyOn(cacheClient, 'ping').mockRejectedValue(new Error('Redis down'));

    await expect(HealthCheckService.check()).rejects.toThrow('Redis down');

    spy.mockRestore();
  });

  it('should throw ServiceUnavailable when dependencies exceed timeout', async () => {
    const dbSpy = vi.spyOn(orm.em, 'execute').mockImplementation(
      // oxlint-disable-next-line no-empty-function
      () => new Promise(() => {}),
    );
    const cacheSpy = vi.spyOn(cacheClient, 'ping').mockImplementation(
      // oxlint-disable-next-line no-empty-function
      () => new Promise(() => {}),
    );

    await expect(HealthCheckService.check()).rejects.toSatisfy((error: CustomError) => {
      expect(error).toBeInstanceOf(CustomError);
      expect(error.status).toBe(HttpStatus.ServiceUnavailable);
      expect(error.message).toBe(ErrorMessage.Generic.SomethingWentWrong);
      return true;
    });

    dbSpy.mockRestore();
    cacheSpy.mockRestore();
  });
});
