import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.{ts,tsx}',
        // 'src/lib/supabase/proxy.ts' // TODO keep proxy for testing because it is manually modified, not just boilerplate
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/lib/supabase/**/*.{ts,tsx}', // exclude supabase client and server code from coverage
      ],
      reporter: ['text', 'html', 'lcov'],
      reportOnFailure: true,
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
