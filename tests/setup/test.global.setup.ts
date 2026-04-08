import { migrationConfig, seederConfig } from '#/mikro-orm.config';
import { MikroORM } from '@mikro-orm/postgresql';

import { env } from '@/configs/environment';

const setup = async () => {
  if (env.CI) {
    return;
  }

  let orm = await MikroORM.init(migrationConfig);
  const schema = orm.config.get('schema');

  await orm.em.fork().getConnection().execute(`
    DROP SCHEMA IF EXISTS ${schema} CASCADE;
    CREATE SCHEMA IF NOT EXISTS ${schema};`);
  await orm.migrator.up();
  await orm.close(true);

  orm = await MikroORM.init(seederConfig);
  await orm.migrator.up();
  await orm.close(true);
};

export default setup;
