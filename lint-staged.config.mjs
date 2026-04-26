// @ts-check
/** @type {import("lint-staged").Configuration} */
const config = {
  '*.ts': (files) => [`bun run lint -- ${files.join(' ')}`],
  '*': (files) => [
    `bun run fmt -- ${files.join(' ')}`,
    `gitleaks git --pre-commit --staged --platform=github --verbose`,
    `bun run knip`,
  ],
};

export default config;
