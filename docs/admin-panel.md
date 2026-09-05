---
title: "Admin Panel"
tags: ["admin", "nextjs", "auth", "data-fetching", "ssr"]
description: "Guide to the admin app at localhost:3001 — route map, proxy-based auth with isolated cookies, the dashboard layout/sidebar/command palette, the useApi + server-api + prefetchPage data-fetching stack, SSR page conventions, and env vars."
order: 21
author: "Acme Inc."
lastUpdated: 1772000000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Admin Panel

> [!NOTE] **What this is.** The management console for the whole system — users, settings,
> email templates/logs, database backups, and the full Telescope observability suite. It's a
> Next.js App Router app (`apps/admin`, port 3001) in the same pnpm monorepo as the API
> (8080), the web app (3000) and the docs app (3002).
>
> **Ground truth** (verified 2026-08-18): all routes are SSR'd (server components prefetch
> data, clients hydrate and poll/stream), auth is cookie-based via a Next.js `proxy.ts`
> (isolated `adminAccessToken`/`adminRefreshToken` cookies), and every page follows the
> `page.tsx` (server, thin) + `<name>-panel.tsx` (client, smart) convention.

## Route map

| Route | Page |
| --- | --- |
| `/auth/login` | Login (server component → `LoginView`, safe `?redirect=` handling) |
| `/auth/forgot-password` | Forgot password |
| `/` | Overview (dashboard, live Telescope activity, component showcases) |
| `/backup` | Database Backup (create/queue/cancel/download/verify/restore + quota chip) |
| `/emails`, `/email-log` | Email templates + delivery log |
| `/settings` (+ `/general`, `/billing`) | Settings |
| `/users`, `/users/[id]` | Users directory + profile (RBAC panel, **impersonate** for super-admins) |
| `/telescope/*` | Requests, detail, SQL, exceptions, jobs, schedules, mail, logs, search, status, compare, users |
| `/[...slug]` | Docs pages rendered from the repo-root `docs/` folder |

The whole panel lives under `/(panel)` — the layout there renders the dashboard shell
(sidebar, topbar, command palette). `/auth/*` is outside the shell.

## Auth & the proxy

`apps/admin/proxy.ts` runs on every request and gates the panel:

- **Authenticated** = `adminAccessToken` cookie present. Only `/auth/login` and
  `/auth/forgot-password` are open to unauthenticated visitors; everything else redirects to
  `/auth/login?redirect=<path>` (the `redirect` param is validated against open-redirects and
  re-used after a successful login).
- **Admin gating** happens twice: the proxy decodes the JWT's `hasAdminAccess` claim for
  route-level protection, and the API's guards re-verify the token on every call.
- **Cookie isolation**: the admin app never shares cookies with the web app — logins send
  `X-Client-Type: admin`, the backend sets `adminAccessToken`/`adminRefreshToken`, and logout
  only clears that set. The API's refresh endpoint reads both cookie names (web + admin).
- **Token refresh** is handled client-side by the `useApi` layer (401 → silent refresh →
  retry), and server-side by the proxy for full navigations (see `docs/token-refresh.md`).

### Session data: `/me` vs `/auth/permissions`

The admin shell uses **`GET /auth/me`** for sidebar identity (name, email) — profile without
permissions. Permission-aware UI (impersonation banner, access panels) uses
**`GET /auth/permissions`** (`api.auth.permissions.useQuery()`).

After RBAC mutations in `UserAccessPanel`, the client calls `invalidateSessionAuth()` from
`@workspace/client/lib/auth/invalidate-session-auth` to refetch both queries.

### Impersonation

Super-admins can impersonate users from `/users/[id]` (`ImpersonateUserButton`). While
impersonating, `ImpersonationBanner` appears above the dashboard shell; **Stop impersonation**
calls `POST /auth/stop-impersonation`, swaps the admin access cookie, and invalidates session
queries. See [Authorization — Impersonation](./authorization.md#impersonation-super-admin).

The login page (`/auth/login`) is a server component: it reads `?redirect=` and the env flags
(`NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS`) **server-side**, keeping
`useSearchParams`/env access out of the client bundle, then hands props to the client
`LoginView` → shared `LoginForm` (`packages/client/src/lib/auth/login-form.tsx`).

## Layout & shell

- `app/layout.tsx`: fonts, `QueryProvider` (TanStack Query), `ClientAuthWrapper` (bridges
  `useRouter` into the auth context, wires the isolated cookie names + admin client type),
  `ThemeProvider`, and the global `<Toaster />` (see `docs/toast.md`).
- `(panel)/layout.tsx` → `dashboard-layout.tsx`: sidebar (menu config in
  `apps/admin/lib/navigation/sidebar-menu.json` + icon map), topbar with breadcrumbs + theme toggle + command
  palette (`⌘K`), and the panel content area.
- Command palette: global search across pages, telescope users, status, documents — the docs
  app's palette matches it (`apps/docs`).

## Data fetching

Two layers share one contract (zod schemas in `packages/shared`, assembled by the router):

1. **`useApi` (client)** — `packages/client/src/lib/api/use-api.ts`. A tRPC-like typed hook
   over REST: `const { api } = useAuth(); const q = api.backup.list.useQuery(undefined);`
   TanStack Query drives caching, polling (`refetchInterval`), and the 401 → silent-refresh
   pipeline. All mutations are `api.<resource>.<action>.useMutation()`.
2. **`server-api` (SSR)** — `packages/client/src/lib/api/server-api.ts`. The same endpoint
   objects, fetched server-side with the `adminAccessToken` cookie forwarded explicitly
   (server components can't rely on a cookie jar). Includes `prefetchPage` +
   `PrefetchBoundary`: pages prefetch their queries during SSR, then the client hydrates them
   so the first paint is already populated.

**The page convention** (see `/backup` as the reference):

```tsx
// page.tsx — thin server component: prefetch + render the client panel
import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";
import { prefetchPage } from "@workspace/client/lib/api/server-api";
import BackupPanel from "./backup-panel";

export const dynamic = "force-dynamic";

export default async function BackupPage(): Promise<React.JSX.Element> {
	const { state, report } = await prefetchPage((server) => [server.backup.list(undefined), server.backup.options(undefined)]);
	return (
		<PrefetchBoundary state={state} report={report}>
			<BackupPanel />
		</PrefetchBoundary>
	);
}
```

`backup-panel.tsx` is the client "smart" component: owns the mutations, polling, toasts, and
all page state. Prefetching is best-effort — if the token is missing or the API is down, the
boundary falls back to the client's own queries (never a correctness dependency).

## Env vars (admin app)

| Env var | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_WEB_URL` | `http://localhost:3000` | "Returning to main website" link |
| `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` | off | One-click demo login (never ship with this on) |

The admin cookies (`adminAccessToken`/`adminRefreshToken`) are hardcoded in `proxy.ts` +
`client-auth-wrapper.tsx` for isolation — the API validates `X-Client-Type: admin` on login
and sets the matching cookie names.
