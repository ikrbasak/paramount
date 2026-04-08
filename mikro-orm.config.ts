import { TSMigrationGenerator as BaseMigrationGenerator, Migrator } from '@mikro-orm/migrations';
import { defineConfig, type MigrationDiff } from '@mikro-orm/postgresql';
import { kebabCase, pascalCase } from 'change-case';
import { format } from 'sql-formatter';

import { config as baseConfig } from '@/configs/database';

class MigrationGenerator extends BaseMigrationGenerator {
  createStatement(sql: string, padLeft: number) {
    sql = format(sql, {
      language: 'postgresql',
      keywordCase: 'upper',
      dataTypeCase: 'upper',
      functionCase: 'lower',
      identifierCase: 'lower',
      denseOperators: false,
    });
    sql = sql
      .split('\n')
      .map((l, i) => (i === 0 ? l : `${' '.repeat(padLeft * 2)}${l}`))
      .join('\n');

    return super.createStatement(sql, padLeft);
  }

  generateMigrationFile(name: string, diff: MigrationDiff) {
    const ts = `${name.split('_').at(0)}`.replaceAll(/[^0-9]/g, '');
    name = `${name.split('_').at(1)}`;
    name = pascalCase(name) + ts;
    return super.generateMigrationFile(name, diff);
  }
}

const cliExtensions = [Migrator];
const extensions = baseConfig.extensions
  ? [...baseConfig.extensions, ...cliExtensions]
  : cliExtensions;

export const migrationConfig = defineConfig({
  ...baseConfig,
  contextName: 'default',
  extensions,
  schemaGenerator: { skipTables: ['__seeders'] },
  migrations: {
    tableName: '__migrations',
    path: 'build/database/_migrations',
    pathTs: 'src/database/_migrations',
    snapshot: false,
    fileName: (timestamp, name = 'migration') => `${timestamp}-${kebabCase(name)}`,
    generator: MigrationGenerator,
  },
});

export const seederConfig = defineConfig({
  ...baseConfig,
  contextName: 'seeder',
  extensions,
  migrations: {
    tableName: '__seeders',
    path: 'build/database/_seeders',
    pathTs: 'src/database/_seeders',
    emit: 'ts',
    snapshot: false,
    fileName: (timestamp, name = 'seeder') => `${timestamp}-${kebabCase(name)}`,
    generator: MigrationGenerator,
  },
});

const configs = [migrationConfig, seederConfig];

/**
 * @internal
 */
export default configs;
