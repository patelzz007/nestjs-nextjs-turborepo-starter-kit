# Admin e2e smoke

`e2e/` holds **opt-in full-stack** tests that exercise the real server (proxy
redirects, SSR output, error pages) rather than unit-mocked logic.

They are skipped by default — vitest's `describe.skipIf(!ADMIN_E2E_BASE_URL)`
keeps them inert in the normal `pnpm test` run.

## Running

```bash
# Terminal 1 — start the API (needs Postgres + env)
pnpm dev:api

# Terminal 2 — build + serve the admin app
cd apps/admin
pnpm build
pnpm start   # http://localhost:3001

# Terminal 3 — run the smoke
ADMIN_E2E_BASE_URL=http://localhost:3001 pnpm --filter @workspace/admin exec vitest run e2e
```

## What it covers

- `GET /auth/login` renders the login page (SSR contains the heading).
- `GET /` (unauthenticated) is redirected to `/auth/login` with a `307`.
- Unknown routes return a graceful `404`.

Add more scenarios here as the panel grows (authenticated session flows need a
real login — pair with the API e2e in `apps/api/test/`).
