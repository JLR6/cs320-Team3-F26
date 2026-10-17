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
application test suites have not been implemented. GitHub Actions currently skips
application tests in bootstrap mode while keeping formatting, linting, type checks,
builds, and dependency audits required. See the CI setup guide to enable full test
enforcement.

See [CI setup](../docs/ci.md) for backend/Supabase test environment instructions,
test commands, and branch protection requirements.

# General Frontend Setup

First, since we are using a `.nvmrc`, pick the correct node version in the terminal with `nvm use`. If `pnpm` isn't installed, run `npm install -g pnpm` and `pnpm -v` to check that it is installed. Stick to using this as it is the default for Next.js and also not a good idea to mix package managers.
Run `pnpm install` when inside the frontend folder after every commit that is pulled locally; can be reached from project root via `cd frontend`.

Make a `.env.local` using the `.env.example` fields and fill them out by looking for the proper values based on the comments in `.env.example`. Never push these keys' values to GitHub - if new ones are needed, add to .env.example and add a comment on how to find the value for the key.

For now, try to run the local server on localhost:3000. Run with `pnpm dev`.
