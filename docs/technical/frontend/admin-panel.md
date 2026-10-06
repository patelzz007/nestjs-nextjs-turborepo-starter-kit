---
title: "Admin Panel"
tags: ["admin", "nextjs", "auth", "data-fetching", "ssr"]
description: "Guide to the admin app at localhost:3001 — route map, proxy-based auth with isolated cookies, the dashboard layout/sidebar/command palette, the useApi + server-api + prefetchPage data-fetching stack, SSR page conventions, and env vars."
order: 21
author: "Platform Team"
lastUpdated: 1791244800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Admin Panel

> [!NOTE] **What this is.** The platform management console — merchants, rewards review, users,
> access control, email templates/logs, geography and the sample catalog. It's a
> Next.js App Router app (`apps/admin`, port 3001) in the same pnpm monorepo as the API
> (8080), the web app (3000) and the docs app (3002).
>
> **Ground truth** (verified 2026-10-04): all routes are SSR'd (server components prefetch
> data, clients hydrate and poll/stream), auth is cookie-based via a Next.js `proxy.ts`
> (isolated `adminAccessToken`/`adminRefreshToken` cookies), and every page follows the
> `page.tsx` (server, thin) + client view component (smart) convention.

## Route map

| Route | Page |
| --- | --- |
Conventions and the shared rules: [Routing](./routing.md). Paths come from `apps/admin/lib/routes.ts`.

| Route | Page |
| --- | --- |
| `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` | Auth (outside the shell; safe `?redirect=` handling) |
| `/` | Overview — the last 30 days' sales KPIs and daily sales chart (real data from one `GET /admin/analytics/dashboard` query, shown with `ANALYTICS.READ`), then the UI kit's component gallery, headed as sample content |
| `/analytics` (`/analytics/sales` redirects here) | Platform dashboard: sales, customer (new / returning) and reward KPIs vs the previous period; sales, bills, claims vs redemptions and new vs returning customers over time; top 10 merchants, sales by category and by city; CSV / Excel / PDF export. Range and interval live in the URL — see [Analytics dashboards](./analytics-charts.md) |
| `/users`, `/users/[id]` | Users directory + profile (RBAC panel, **impersonate**) — super-admin |
| `/users/mfa-recovery` | MFA recovery request queue — super-admin |
| `/merchants` (+ `/invites`, `/verification`, `/store-requests`) | Merchants, merchant invites, KYB verification queue, store requests |
| `/rewards/review` (`/rewards` redirects) | Rewards awaiting review |
| `/emails/templates`, `/emails/log` (`/emails` redirects) | Email template previews (`?key=`) + delivery log |
| `/geography` | Geographic reference data |
| `/audit-logs`, `/audit-logs/[id]` | The global HTTP audit trail (`LIST:AUDIT_LOG` / `READ:AUDIT_LOG`): filterable table (outcome, method, credential, device, address class, trigram-indexed search; actor / organization / correlation id from a record's links — all in the URL) with colour-coded chips. Clicking a row opens the complete record in a drawer (`?record=`, shareable); `/audit-logs/[id]` is the same record as its own page (`components/audit-logs/audit-log-record.tsx` renders both). Every view is itself audited by the API |
| `/catalog/products`, `/catalog/categories` (`/new`, `/[id]`, `/[id]/edit`; `/catalog` redirects) | Example CRUD resources |
| `/settings/access` (`/settings` redirects to it) | Platform settings: roles, permissions, permission checker |
| `/account/profile` | The signed-in admin's own profile: avatar + name, edited with `PATCH /auth/profile` (server-prefetched `GET /auth/profile`, TanStack Form on the shared `OwnProfileEditableFieldsSchema`, read-only while impersonating). Open to every signed-in admin; listed in `page-api-coverage.test.ts` as an own-record call |
| `/account/security` (`/account` redirects to it) | The signed-in admin's password and 2FA (email verification / MFA enrollment lands here) |
| `/[...slug]` | Unknown paths → the in-shell 404 |

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
queries. See [Authentication — Impersonation](../security/authentication.md#impersonation).

The login page (`/auth/login`) is a server component: it resolves `?redirect=` with
`resolveAdminRedirectTarget` (`lib/auth-routes.ts`: parsed against the admin origin, same origin
only, no backslash or control character raw or percent-decoded, never into `/auth/**` in any
letter case; the normalized `pathname + search + hash` is used, anything else falls back to `/`),
reads `clientEnv.NEXT_PUBLIC_WEB_URL` and — only in development (shared `resolveDemoAccounts` policy, no flag) —
the seeded demo logins (`lib/auth/demo-accounts.ts` loads the `server-only` `demo-account-list.ts` lazily), and hands them as props to
`LoginView` → shared `LoginForm`. The proxy applies the same resolver when it bounces a signed-in
admin away from the login page. The four auth pages share `components/auth/admin-auth-layout.tsx`;
the token pages read and validate `?token=` server-side with the shared reset / verify-email
schemas, and the stated link lifetimes come from `PASSWORD_RESET_LINK_TTL_HOURS` /
`EMAIL_VERIFICATION_LINK_TTL_HOURS` in `@workspace/shared`.

Old URLs of renamed pages (`/rewardhub/*`, `/product/*`, `/sample-category/*`, `/geo`,
`/email-log`, `/users/all`, `/settings/security*`, `/admin/email-template`) answer with a 308 to
the current page (`lib/navigation/legacy-redirects.ts`, loaded by `next.config.ts`).

## Layout & shell

- `app/layout.tsx`: fonts, `QueryProvider` (TanStack Query), `ClientAuthWrapper` (bridges
  `useRouter` into the auth context, wires the isolated cookie names + admin client type),
  `ThemeProvider`, and the global `<Toaster />` (see [Toasts](./toast.md)).
- `(panel)/layout.tsx` → `dashboard-layout.tsx`: sidebar (menu config in
  `apps/admin/lib/navigation/sidebar-menu.json` + icon map), topbar with breadcrumbs + theme toggle + command
  palette (`⌘K`), and the panel content area.
- The shell lives in the `(panel)` **route-group layout**, so it stays mounted across navigations:
  sidebar, topbar and their state survive, and only the page segment changes. Inside the group,
  `loading.tsx` streams a content skeleton, `error.tsx` is the client error boundary ("Try again"),
  and `[...slug]/page.tsx` + `not-found.tsx` render unknown panel URLs as a 404 **inside** the shell.
  The root `app/not-found.tsx` covers URLs outside the panel. Both use the shared `NotFoundContent`
  from `@workspace/ui`.
- Command palette (`⌘K`): global search across the menu pages. The docs
  site (`apps/docs`) has its own `⌘K` search over a build-time index (`apps/docs/src/scripts/search.ts`).

### Panel sidebars (web, merchant, admin)

All three panels share one sidebar implementation in `packages/ui/src/components/navigation/`
(`panel-sidebar-nav*.tsx`): `PanelSidebarNav` (search box + a `<nav>` landmark with pinned pages and
sections), `PanelSidebarFooterNav` (bottom items, a second named `<nav>`), `PanelSidebarNavItem` and
`PanelSidebarRouteAnnouncer`. Each app passes its menu view, labels, icon renderers and a bare link
element (`renderLink`).

- Leaves are real links with `aria-current="page"`; branches are disclosure buttons
  (`aria-expanded` / `aria-controls`) for a `role="group"` list; disabled items are `aria-disabled`
  links with a described reason.
- The current page is scrolled into view once branch transitions finish (`useScrollActiveNavItem`,
  Web Animations API — no timer); `/` focuses the search (`useFocusShortcut`); the route
  announcement uses the resolved breadcrumb label.
- Expansion state is the sidebar feature store's page-scoped `manualExpansion`
  ([ADR 023](../../adr/023-client-state-feature-stores.md)). `AppPanelShell` takes `scrollResetKey`
  (the pathname) to scroll its `<main>` to the top on navigation without remounting the page.
- Money and counts in charts and tables go through `formatMinorUnits` / `formatCount`
  (`packages/ui/README.md`, "Formatting dates, counts and money") — never raw minor units or the
  browser's default `toLocaleString()`.

### Colour: the tone palette

Categorical chips (HTTP method, status class, credential, device, address class …) use the
`Badge` tone variants `green`, `blue`, `yellow`, `red`, `orange`, `teal` and `violet`
(`<Badge variant="teal">`). Each is a `--tone-X` text colour on its `--tone-X-soft` fill, defined
for light and dark in `packages/ui/src/styles/tokens.css`, and every pair is held to WCAG AA text
contrast by `tokens-contrast.test.ts`. Pick tones from a typed `Record<Value, BadgeVariant>` (see
`components/audit-logs/audit-log-badges.tsx`) — never raw Tailwind palette classes — so a new
value cannot ship uncoloured and a theme can retune every chip at once.

## Data fetching

Two layers share one contract (zod schemas in `packages/shared`, assembled by the client router):

1. **Client** — the typed router in `packages/client/src/lib/api/` (`api.<group>.<leaf>.useQuery()` /
   `.useMutation()` over TanStack Query): caching, polling, and the 401 → silent-refresh pipeline.
2. **Server** — `createAdminServerCaller()` (`apps/admin/lib/admin-server-api.ts`, built on
   `packages/client/src/lib/api/server-api.ts`) calls the same endpoints during SSR with the admin
   cookie forwarded explicitly.

**The page convention** — a thin server `page.tsx` parses the URL state, prefetches exactly what the
first paint needs and hands it to the client view as initial data (`/geography` is the reference):

```tsx
// apps/admin/app/(panel)/geography/page.tsx (abridged)
export default async function GeoPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = GEO_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [statsResult, pageResult] = await Promise.all([
		prefetch({ page: "/geography", resource: "geo stats" }, () => server.geo.stats.query({})),
		prefetch({ page: "/geography", resource: `${urlState.tab} page` }, () => fetchActiveTabPage(server, urlState)),
	]);
	return <GeoView initialStats={resolvePrefetchedData(statsResult)} initialPage={resolvePrefetchedQuery(GEO_URL_STATE.serialize(urlState), pageResult)} />;
}
```

The client view is the smart component (queries, mutations, toasts, page state). Prefetching is
best-effort (`apps/admin/lib/server/prefetch.ts`): a failed prefetch is logged and the client fetches
on its own. URL state conventions: [Routing](./routing.md).

## Env vars (admin app)

| Env var | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | required | API base URL |
| `NEXT_PUBLIC_ADMIN_URL` | required | The admin app's own origin (session-refresh `Origin`) |
| `NEXT_PUBLIC_WEB_URL` | required | "Returning to main website" link, impersonation banner |
| `NEXT_PUBLIC_MERCHANT_URL` | required | Impersonation banner merchant-portal link |
| `NEXT_PUBLIC_SESSION_POLL_MS` | unset (disabled) | Opt-in session-badge steady poll (ms) |
| `COOKIE_DOMAIN` | unset | Server-only; cookie domain used when the proxy clears auth cookies |

All of these are validated by `lib/env/env.client.ts` / `env.server.ts`, and there are no
hardcoded fallbacks. See [Configuration](../configuration/frontend.md).

The admin cookies (`adminAccessToken`/`adminRefreshToken`) are hardcoded in `proxy.ts` +
`client-auth-wrapper.tsx` for isolation — the API validates `X-Client-Type: admin` on login
and sets the matching cookie names.
