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

- `GET /auth/login` renders the login page (the SSR HTML contains the heading).
- `GET /` (unauthenticated) is answered with a `307` to `/auth/login?redirect=%2F`
  (Node's `fetch` exposes the real redirect with `redirect: "manual"`).
- An unknown route is, for a guest, the same `307` to login: the proxy treats
  every non-auth path as a panel route, so the 404 page is only ever rendered
  for signed-in admins.
- An off-origin `?redirect=` on the login page is never echoed into the page.

Add more scenarios here as the panel grows (authenticated session flows need a
real login — pair with the API e2e in `apps/api/test/`).

## Browser suite (Playwright)

`e2e/*.browser.ts` run in real Chromium (`pnpm --filter @workspace/admin test:browser`)
for what only a browser can prove — the URL-state layer's History API writes and
Back/Forward restore. They need a running admin app and a seeded API whose
`LOGIN_VERIFICATION_MODE=disabled` (non-production only, so the spec can sign in
without the emailed code), and the env in `e2e/browser-env.e2e.ts`:

```bash
ADMIN_E2E_BASE_URL=http://localhost:3001 \
ADMIN_E2E_EMAIL=superadmin@example.com ADMIN_E2E_PASSWORD='SuperAdmin@123' \
pnpm --filter @workspace/admin test:browser
```

First run on a machine: `pnpm --filter @workspace/admin exec playwright install chromium`.
The web app has the same suite (`WEB_E2E_BASE_URL=… pnpm --filter @workspace/web test:browser`).
