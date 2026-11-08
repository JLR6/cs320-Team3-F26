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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // for explicitly visual components, unit tests only prove if they render or not which isn't valuable
        'src/components/ui/**/*.{ts,tsx}', // Generated components, doesn't make sense to test them
        'src/components/**/presentation/**/*.{ts,tsx}', // presentation components don't have anything worth testing as they are purely visual
        'src/app/providers.tsx', // tanstack boilerplate, not worth testing
        'src/components/ThemeProvider.tsx', // theme boilerplate, not worth testing
        // these are components that are more worth testing visually, not through unit tests
        'src/components/app-header.tsx',
        'src/components/app-sidebar.tsx',
        'src/app/layout.tsx', // layout is a visual thing, not worth testing through unit tests
        'src/app/**/page.tsx', // pages are all layout and visual components
        'src/hooks/use-mobile.ts', // shadcn sidebar helper

        'src/lib/supabase/client.ts', // client and server are both boilerplate while proxy is actually manually modified
        'src/lib/supabase/server.ts',
        'src/app/callback/**/*.{ts,tsx}', // auth callback page is just a redirect and will be tested through e2e tests
        /** TODO not covered in this pr atm **/
        'src/lib/routes.ts', // nothing really here to test besides checking url when going to distinct posts
        'src/components/auth/ForgotPasswordForm.tsx', // not a part of this PR, can add after Elizabeth's PR is merged
        /** ------------------ uncovered ----------------  **/
        'src/types/**/*.{ts,tsx}', // types are not worth testing
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/lib/routes.ts', // nothing really here to test besides checking url when going to distinct posts
        'src/lib/mock-user.ts', // mock user is only used in e2e tests, not worth testing through unit tests
        'src/types/**/*.{ts,tsx}', // types are not worth testing
        'src/components/**/presentation/**/*.{ts,tsx}', // presentation components are components without any logic besides rendering
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      reportOnFailure: true,
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
