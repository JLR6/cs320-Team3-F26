# Frontend CI setup

This directory contains minimal Next.js boilerplate and the tooling required to
build, format, lint, type-check, and test it in CI. The page is blank; application
components, styling, data fetching, and feature dependencies are left to the
frontend developers.

The frontend uses Node.js 24 and pnpm 10.34.6. Select Node.js 24 with your version
manager (`nvm use` if you use nvm), then run these commands from the repository root:

```sh
npm exec --yes --package=pnpm@10.34.6 -- pnpm --dir frontend install --frozen-lockfile
npm exec --yes --package=pnpm@10.34.6 -- pnpm --dir frontend run format:check
npm exec --yes --package=pnpm@10.34.6 -- pnpm --dir frontend run lint
npm exec --yes --package=pnpm@10.34.6 -- pnpm --dir frontend run typecheck
npm exec --yes --package=pnpm@10.34.6 -- pnpm --dir frontend run build
```

These commands use pinned pnpm through `npm exec`, without relying on a global
Corepack installation.

Commit `pnpm-lock.yaml` with dependency changes. Add unit tests matching
`src/**/*.test.{ts,tsx}` and browser tests under `test/e2e`.
`pnpm test:coverage` requires at least 90% in all four coverage metrics;
`pnpm test:e2e` runs Chromium, Firefox, and WebKit. Both currently fail because
application test suites have not been implemented.

See [CI setup](../docs/ci.md) for backend/Supabase test environment instructions,
test commands, and branch protection requirements.
