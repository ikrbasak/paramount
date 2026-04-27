// @ts-check
/** @type {import("lint-staged").Configuration} */
const config = {
  '*.ts': (files) => [`bun run lint -- ${files.join(' ')}`],
  '*': (files) => [`bun run fmt -- ${files.join(' ')}`, `bun run knip`],
};

export default config;
