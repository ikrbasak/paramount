import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import type { MaybePromise } from 'bun';

import { config } from '@/configs/database';

export const orm = await MikroORM.init(config);
export const withOrmContext = <T>(fn: () => MaybePromise<T>) => RequestContext.create(orm.em, fn);
