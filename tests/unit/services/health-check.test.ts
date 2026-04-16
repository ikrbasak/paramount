import { describe, expect, it, vi } from 'vitest';

import { cacheClient } from '@/cache/client';
import { orm } from '@/database/connection';
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
});
