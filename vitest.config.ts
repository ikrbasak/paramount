import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    alias: {
      '~': join(process.cwd(), 'tests/'),
      '@': join(process.cwd(), 'src/'),
      '#': join(process.cwd(), '/'),
    },
    bail: 1,
    coverage: {
      clean: true,
      exclude: ['**/*.d.ts', '**/_*', '**/_*/**', 'src/index.ts', 'src/types'],
      include: ['src/**'],
      provider: 'istanbul',
      reporter: ['text', 'html', 'cobertura', 'json', 'json-summary'],
      reportOnFailure: true,
      reportsDirectory: 'coverage',
      // NOTE: Keep track of thresholds, and update if necessary
      thresholds: {
        branches: 2,
        functions: 2,
        lines: 2,
        statements: 2,
      },
    },
    environment: 'node',
    expect: { requireAssertions: true },
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    outputFile: {
      json: 'junit.json',
      junit: 'junit.xml',
    },
    passWithNoTests: false,
    reporters: ['junit', 'json', 'default'],
    testTimeout: 10_000,
    watch: false,
    detectAsyncLeaks: true,
    sequence: { shuffle: { files: true, tests: false } },
    setupFiles: ['tests/setup/test.setup.ts'],
    globalSetup: ['tests/setup/test.global.setup.ts'],
  },
});
