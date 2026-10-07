# Frontend CI setup

This directory contains minimal Next.js boilerplate and the tooling required to
build, format, lint, type-check, and test it in CI. The page is blank; application
components, styling, data fetching, and feature dependencies are left to the
frontend developers.

Use Node.js 24 and pnpm 10.34.6:

```sh
npm install --global pnpm@10.34.6
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Commit `pnpm-lock.yaml` with dependency changes. Add unit tests matching
`src/**/*.test.{ts,tsx}` and browser tests under `test/e2e`.
`pnpm test:coverage` requires at least 90% in all four coverage metrics;
`pnpm test:e2e` runs Chromium, Firefox, and WebKit. Both currently fail because
application test suites have not been implemented.

See [CI setup](../docs/ci.md) for backend/Supabase test environment instructions,
test commands, and branch protection requirements.
