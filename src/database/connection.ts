import { MikroORM, RequestContext } from '@mikro-orm/postgresql';

import { config } from '@/configs/database';

export const orm = await MikroORM.init(config);
export const withOrmContext = <T>(fn: () => Bun.MaybePromise<T>) =>
  RequestContext.create(orm.em, fn);
