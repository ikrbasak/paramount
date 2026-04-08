import { setTimeout } from 'node:timers/promises';

import { cacheClient } from '@/cache/client';
import { Duration } from '@/constants/duration';
import { ErrorMessage } from '@/constants/error-message';
import { HttpStatus } from '@/constants/http-status';
import { orm } from '@/database/connection';
import { CustomError } from '@/lib/error';

export class HealthCheckService {
  static async check() {
    await Promise.race([
      Promise.all([orm.em.execute('select now() as now;'), cacheClient.ping()]),
      setTimeout(Duration.HealthCheckTimeoutMS).then(() => {
        throw new CustomError(
          HttpStatus.ServiceUnavailable,
          ErrorMessage.Generic.SomethingWentWrong,
        );
      }),
    ]);

    return true;
  }
}
