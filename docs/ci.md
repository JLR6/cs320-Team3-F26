# CI skeleton

GitHub Actions runs for PRs targeting `main` or `dev`, pushes to either branch
(including merges), and manual dispatches. Deployment is not configured.

## Current state

**Unit, integration, and E2E suites still need to be implemented.** Empty suites
fail; they are not treated as passing coverage. An affected application therefore
cannot pass the full pipeline until its developers add meaningful tests. The
integration/E2E job waits for applicable component checks to pass first.

## Checks

| Changes | Backend | Frontend | Integration + E2E |
| --- | --- | --- | --- |
| Backend code, dependencies, Supabase config/migrations | Run | Skip | Run |
| Frontend code, dependencies, browser test configuration | Skip | Run | Run |
| Workflow, runtime version, CI helpers, shared/root files | Run | Run | Run |
| Markdown documentation or `.gitkeep` files only | Skip | Skip | Skip |
| Manual run, new branch, or unavailable comparison history | Run | Run | Run |

PR change detection compares the head against its merge base with the target.
Pushes compare `before` and `after`, including merge and squash commits. Renames
are treated as deletion plus addition. Missing history runs all checks.

Both apps use Node.js 24 from `.nvmrc`. Backend installs use `npm ci` with
`backend/package-lock.json`. Frontend installs use pnpm 10.34.6, pinned through
`packageManager`, with `pnpm install --frozen-lockfile` and `frontend/pnpm-lock.yaml`.
The workflow audits all dependencies at high/critical severity, lints, type-checks,
builds, and runs unit coverage. Frontend formatting is also checked with Prettier.

Each application's Vitest configuration requires at least 90% lines, statements,
functions, and branches, including unimported source files. Tests and declarations
are excluded; backend process startup is excluded from unit coverage and should
be exercised by E2E tests. No `passWithNoTests` or coverage suppression is enabled.

Actions are pinned to commit SHAs. Dependabot checks action and package updates
weekly. Package downloads are cached; installed dependencies are not cached.
Read-only permissions, job timeouts, and cancellation of superseded runs are set.
Coverage and failure diagnostics are retained for seven days.

## Integration and E2E environment

The environment job starts isolated local Supabase through its locked CLI on a
Docker-enabled runner, resets the local database, and exports generated test
credentials. No hosted database or GitHub repository secrets are needed. Future
migrations belong under `backend/supabase/migrations`. Seeding is disabled until
we add fixtures and configure `db.seed` in `config.toml`.

Integration tests run through `backend/vitest.integration.config.ts`. Browser
checks use Playwright against production builds of both apps in Chromium,
Firefox, and WebKit. Playwright starts the backend on port 3001 and frontend on
port 3000, without requiring any custom health endpoint or page content. 
Playwright is pretty new to me so frontend team feel free to use something else!

The environment job installs/builds both apps even when only one changed, because
full-system tests require both. It captures Supabase logs on failure, uploads
browser reports/traces/screenshots, and stops Supabase even after failures.

## Where To Implement Your Tests

- Backend unit tests: `src/**/*.spec.ts` or `modules/**/*.spec.ts`.
- Backend integration tests: `test/integrations/**/*.test.ts`.
- Frontend unit tests: `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Browser tests: `frontend/test/e2e/*.spec.ts`.

## Local commands

Use Node.js 24 (`nvm use`), then from the repository root:

```sh
npm install --global pnpm@10.34.6
npm ci --prefix backend
pnpm --dir frontend install --frozen-lockfile
python3 -m unittest discover -s scripts/ci -p 'test_*.py'
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
pnpm --dir frontend run format:check
pnpm --dir frontend run lint
pnpm --dir frontend run typecheck
pnpm --dir frontend run build
npm --prefix backend audit --audit-level=high
pnpm --dir frontend audit --audit-level=high
```

After you implement test suites:

```sh
npm --prefix backend run test:coverage
pnpm --dir frontend run test:coverage
```

For integration/E2E tests, start Docker and this project's disposable Supabase:

```sh
cd backend
npx --no-install supabase start
npx --no-install supabase db reset --local
npx --no-install supabase status
cd ..
```

If the tests require Supabase, export local `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` using the values from `supabase status` in the same
shell. Never use production credentials. The Actions job exports these values
through `scripts/ci/export-supabase-env.py` and masks keys in logs.

With suites implemented and both apps built:

```sh
npm --prefix backend run test:integration
cd frontend
pnpm exec playwright install chromium firefox webkit
PORT=3001 CI=true pnpm run test:e2e
cd ../backend
npx --no-install supabase stop --no-backup
```
