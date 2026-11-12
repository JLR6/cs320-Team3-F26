import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'modules/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'modules/**/*.ts'],
      // Keep process startup separate from unit coverage; cover it in E2E tests.
      exclude: ['**/*.spec.ts', '**/*.d.ts', 'src/main.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportOnFailure: true,
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
