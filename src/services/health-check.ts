import { cacheClient } from '@/cache/client';
import { orm } from '@/database/connection';

export class HealthCheckService {
  static async check() {
    await Promise.all([orm.em.execute('select now() as now;'), cacheClient.ping()]);
    return true;
  }
}
