// @ts-check
/** @type {import("lint-staged").Configuration} */
const config = {
  '*.ts': (files) => [
    `bun run lint -- ${files.join(' ')}`,
    `bun run fmt -- ${files.join(' ')}`,
    'bunx tsc',
    'bunx tsc -p tsconfig.build.json',
    'bun run build',
  ],
  '*': (files) => [`bun run fmt -- ${files.filter((f) => !f.endsWith('.ts')).join(' ')}`],
};

export default config;
