import type { KnipConfig } from 'knip';
type RawConfiguration = KnipConfig extends (options: unknown) => infer R
  ? R extends Promise<infer P>
    ? P
    : R
  : KnipConfig;

const config: KnipConfig = () => {
  const config: RawConfiguration = {
    project: ['src/**/*.ts!', 'tests/**/*.ts', 'mikro-orm.config.ts'],
    ignoreFiles: ['src/database/_migrations/*.ts', 'src/database/_seeders/*.ts'],
    tags: ['-@internal'],
    ignoreDependencies: ['@mikro-orm/cli'],
    bun: true,
    typescript: true,
    vitest: true,
    ignoreBinaries: ['gitleaks'],
  };

  return config;
};

export default config;
