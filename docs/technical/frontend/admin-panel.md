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

| Route                                                                                                  | Page |
| ------------------------------------------------------------------------------------------------------ | ---- |
| Conventions and the shared rules: [Routing](./routing.md). Paths come from `apps/admin/lib/routes.ts`. |

| Route                                                                                            | Page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`             | Auth (outside the shell; safe `?redirect=` handling)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/`                                                                                              | Overview — the last 30 days' sales KPIs and daily sales chart (real data from one `GET /admin/analytics/dashboard` query, shown with `ANALYTICS.READ`), then — where the deployment serves the developer component gallery (`ADMIN_COMPONENT_GALLERY`, off in production by default) — the UI kit's component gallery, headed as sample content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/analytics` (`/analytics/sales` redirects here)                                                 | Platform dashboard: sales, customer (new / returning) and reward KPIs vs the previous period; sales, bills, claims vs redemptions and new vs returning customers over time; top 10 merchants, sales by category and by city; CSV / Excel / PDF export. Range and interval live in the URL — see [Analytics dashboards](./analytics-charts.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/users`, `/users/[id]`                                                                          | Users directory + profile (RBAC panel, **impersonate**) — super-admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/users/mfa-recovery`                                                                            | MFA recovery request queue — super-admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/merchants` (+ `/invites`, `/verification`, `/store-requests`)                                  | Merchants, merchant invites, KYB verification queue, store requests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/rewards/review`, `/rewards/review/[id]` (`/rewards` redirects)                                 | The moderation queue (`MANAGE:REWARD`): a compact list — cover, title, merchant — whose **View more** opens the reward's page. That page (`GET /admin/rewards/:rewardId`, any status) shows the photos (carousel, full-size viewer, download one or all as a ZIP), the copy and every condition, and approves or rejects the reward while it is pending review, then returns to the queue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/emails/templates`, `/emails/log` (`/emails` redirects)                                         | Email template previews (`?key=`) + delivery log                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/geography`                                                                                     | Geographic reference data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/audit-logs`, `/audit-logs/[id]`                                                                | The global HTTP audit trail (`LIST:AUDIT_LOG` / `READ:AUDIT_LOG`): filterable table (outcome, method, credential, device, address class, trigram-indexed search; actor / tenant / correlation id from a record's links — all in the URL) with colour-coded chips. Clicking a row opens the complete record in a drawer (`?record=`, shareable); `/audit-logs/[id]` is the same record as its own page (`components/audit-logs/audit-log-record.tsx` renders both). Every view is itself audited by the API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/catalog/products`, `/catalog/categories` (`/new`, `/[id]`, `/[id]/edit`; `/catalog` redirects) | Example CRUD resources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/settings/access` (`/settings` redirects to it)                                                 | Platform settings: roles, permissions, permission checker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/account/profile`                                                                               | The signed-in admin's own profile: avatar (the shared `ProfileAvatarEditor` — square, cropped first unless it already is) + name, edited with `PATCH /auth/profile` (server-prefetched `GET /auth/profile`, TanStack Form on the shared `OwnProfileEditableFieldsSchema`, read-only while impersonating). Open to every signed-in admin; listed in `page-api-coverage.test.ts` as an own-record call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/components`                                                                                    | The web UI kit's gallery front page: every low-level primitive of `packages/ui` as a card, grouped by family, with the kit's totals. It is server-rendered links and counts only (`examples/examples-manifest.ts`), so no demo code loads here. A sticky side navigation (`gallery-nav.tsx`, inside `gallery-shell.tsx`) lists every component by family. Each family collapses like the app sidebar's groups, and a filter expands every match. The whole list collapses to a rail with an animated slide; while collapsed it stays mounted (inert), keeping its filter and open families. Below `lg` a "Browse components" button opens the same list in a sheet, which closes when a component is picked. Its open state lives in its own cookie (`gallery-nav-cookie.ts`), read by the layout on the server, so it opens and closes independently of the app sidebar. Sample content only, no API calls; open to every signed-in admin (sidebar: Platform → Components → Gallery) wherever the deployment serves the gallery: `ADMIN_COMPONENT_GALLERY`, unset → on in development and test, off in production (the layout answers 404 and the sidebar hides the item). The mobile twin is the app's Settings → Components screen (`packages/ui-native`), in development builds only                                                    |
| `/components/[slug]`                                                                             | One component's page (`component-page.tsx`), with the slug looked up in `gallery-catalog.ts` (anything else is a 404). It shows the name, family and description, then the live demo of its variants, sizes and states, then its worked examples (one per row, at full width), then the previous and next components. The family module renders only this component's section (`ActiveGalleryComponentProvider`), so a page loads one family's demo code and one component's examples, never the whole kit. The examples are the 1,264 ReUI examples ported to the kit's rules, in `components/component-gallery/examples/<component>/`. `pnpm --filter @workspace/admin gallery:examples` regenerates their registry and count manifest, which their test keeps in sync. Each example mounts as it nears the viewport, in a React transition, behind a static placeholder, and `content-visibility: auto` skips painting the ones scrolled away                                                                                                                                                                                                                                                                                                                                                                                            |
| `/components/kanban-board` (`/tasks/[id]`, `/tasks/[id]/edit`)                                   | The staff's two linked kanban boards (sidebar: Platform → Components → Kanban; `LIST KANBAN_TASK`, and the section's `component-gallery` flag). Planning / Execution and Board / List / Table views of `GET /admin/kanban/board?board=…`, plus a Hierarchy view (both boards as one expandable tree down to subtasks), with collapsible swimlanes by epic, feature or story, cards that open their children in place, searched, filtered and sorted in the browser with the state in the URL (`KANBAN_BOARD_URL_STATE`); cards and columns move by drag and drop (the kit's `Kanban`) and are sent as one anchored move, the answer replacing the cached board; column headers show their soft WIP limit. "Add …" (a dialog whose fields follow the item's level), "Import CSV" and "Add from template". An item's read-only page is laid out as a document: hierarchy trail, icon and title, a property list (status, people, dates, points, progress, tallies, labels, watchers), then the description, checklist (ticked in place), children, links, files, comments (with files) and a folded history; editing is its own page (details, checklist editors, parent, assignee, dates, estimate). The gallery files sit in the `(gallery)` route group so its shell and 404 switch never wrap the board. See [Kanban board](../kanban.md) |
| `/account/security` (`/account` redirects to it)                                                 | The signed-in admin's password and 2FA (email verification / MFA enrollment lands here)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/[...slug]`                                                                                     | Unknown paths → the in-shell 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

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
`@workspace/client/lib/contexts/identity/invalidate-session-auth` to refetch both queries.

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

Old URLs of renamed pages (`/dashboard/*`, `/product/*`, `/sample-category/*`, `/geo`,
`/email-log`, `/users/all`, `/settings/security*`, `/admin/email-template`) answer with a 308 to
the current page (`lib/navigation/legacy-redirects.ts`, loaded by `next.config.ts`).

## Layout & shell

- `app/layout.tsx`: fonts, `QueryProvider` (TanStack Query), `ClientAuthWrapper` (bridges
  `useRouter` into the auth context, wires the isolated cookie names + admin client type),
  `ThemeProvider`, and the global `<Toaster />` (see [Toasts](./toast.md)).
- `(panel)/layout.tsx` → `dashboard-layout.tsx`: sidebar (menu config in
  `apps/admin/lib/navigation/sidebar-menu.json` + icon map), topbar with breadcrumbs + theme toggle + command
  palette (`⌘K`), and the panel content area.
- Layout: **app shell 3**, shared with web and merchant ([ADR 049](../../adr/049-shared-app-shell-and-sidebar-motion.md)):
  `StoreBoundAppPanelShell` → `AppPanelShell`, with `AppShellHeader`, `PanelSidebarHeader` and
  `AppShellSidebarAccount` from `packages/ui`; the admin supplies its menu, breadcrumb, status and profile
  menu. The `Sidebar` is `variant="inset"` and `collapsible="offcanvas"`: it collapses
  **completely** (no icon rail). It holds the chrome — brand and the collapse toggle in its header; the
  menu; and in its footer the connection / session status, the user row (it opens the profile menu:
  profile, security, settings, log out), the theme toggle and log out. The page is a floating panel beside
  it (`SidebarInset`, rounded, edged with the soft `--border`), headed by `AppShellHeader` (3.5rem, on
  the panel's surface, a soft hairline under it): the
  breadcrumb trail and Search (`⌘K`), plus an expand toggle shown only while the sidebar is out of sight
  (collapsed on desktop — CSS reads its state; always on phones, where the sidebar is a drawer). Only the
  page under it scrolls. `⌘B` toggles the sidebar anywhere; it opens and closes on one spring the whole
  layout follows — the page column widens from 88 rem to 104 rem as it collapses — and charts hold their
  size until it settles. The open state is mirrored to a cookie the `(panel)` layout reads, so a reload
  renders it as it was left.
  The block's demo files (nav data, user, "latest change" card) are not used.
- Surfaces (shared tokens, `packages/tokens`): frame `shell-frame` and page panel `shell-panel` — light
  has no white chrome: a `#F5F7FB` frame around the `#F1F4F9` canvas (one cool hue), near-white `#F9FAFC` cards; dark: `ink-950` frame,
  `ink-850` panel, `ink-750` cards. The inset sidebar is see-through, so it sits on the frame. Colours
  live in the token source only: the sidebar tokens (`--sidebar-active` = the solid slate pill,
  `--sidebar-primary`, …) and the shell roles; `admin-theme.css` declares none. The sidebar keeps every
  behaviour of the shared panel nav: menu filter (`/`), pinned pages, section reorder (hover a group
  label), nested branches, per-page expansion, disabled rows.
- The shell lives in the `(panel)` **route-group layout**, so it stays mounted across navigations:
  sidebar, topbar and their state survive, and only the page segment changes. Inside the group,
  `error.tsx` is the client error boundary ("Try again"), and `[...slug]/page.tsx` + `not-found.tsx`
  render unknown panel URLs as a 404 **inside** the shell.
- Loading states: **every panel route has its own `loading.tsx`**, shaped like that page (header,
  section order, cards vs bare, grid columns, table column count), so content lands where the
  skeleton stood. The compositions live in `components/loading/` and are built from the kit's
  `Skeleton`, `SkeletonRegion` and `skeleton-patterns` — exactly one `SkeletonRegion` (one polite,
  named announcement, e.g. "Loading users…") per loading surface; the labels are module constants in
  `components/loading/loading-labels.ts`. Routes that share a shape share a composition
  (`TablePageSkeleton` + a `TablePageShape` per list page, `CatalogEditorPageSkeleton`,
  `CatalogDetailPageSkeleton`). Index routes that only redirect (`/catalog`, `/emails`, `/rewards`,
  `/settings`, `/account`) wait in their target's shape. `(panel)/loading.tsx` is the generic fallback
  (header over a table) for any route without its own; since a `loading.tsx` wraps its segment's page
  **and every child segment**, the dashboard page lives in the `(home)` route group so its own
  skeleton does not become everyone's fallback. In-page loading (a drawer's record, a queue, a
  catalog tab, a selected merchant) reuses the same bones in its own `SkeletonRegion`, and the route
  guard shows the content skeleton ("Checking your access…") while permissions resolve.
  The root `app/not-found.tsx` covers URLs outside the panel. Both use the shared `NotFoundContent`
  from `@workspace/ui`.
- Command palette (`⌘K`): global search across the menu pages. The docs
  site (`apps/docs`) has its own `⌘K` search over a build-time index (`apps/docs/src/scripts/search.ts`).

### Panel sidebars (web, merchant, admin)

All three panels share one sidebar implementation in `packages/ui/src/components/`
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
- Expansion state is the route's branches (the current page's ancestors) plus the sidebar feature
  store's page-scoped, session-only `manualExpansion`. Following any sidebar link clears the manual
  choices, and a reload shows only the route's branches
  ([ADR 023](../../adr/023-client-state-feature-stores.md)). `AppPanelShell` takes `scrollResetKey`
  (the pathname) to scroll its `<main>` to the top on navigation without remounting the page.
- Money and counts in charts and tables go through `formatMinorUnits` / `formatCount`
  (`packages/ui/README.md`, "Formatting dates, counts and money") — never raw minor units or the
  browser's default `toLocaleString()`.

### Colour: the tone palette

Categorical chips (HTTP method, status class, credential, device, address class …) use the
`Badge` tone variants `green`, `blue`, `yellow`, `red`, `orange`, `teal` and `violet`
(`<Badge variant="teal">`). Each is a `--tone-X` text colour on its `--tone-X-soft` fill, defined
for light and dark in `packages/tokens/src/semantic.ts` (generated into `packages/tokens/generated/web.css`), and every pair is held to WCAG AA text
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

| Env var                       | Default          | Purpose                                                            |
| ----------------------------- | ---------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`         | required         | API base URL                                                       |
| `NEXT_PUBLIC_ADMIN_URL`       | required         | The admin app's own origin (session-refresh `Origin`)              |
| `NEXT_PUBLIC_WEB_URL`         | required         | "Returning to main website" link, impersonation banner             |
| `NEXT_PUBLIC_MERCHANT_URL`    | required         | Impersonation banner merchant-portal link                          |
| `NEXT_PUBLIC_SESSION_POLL_MS` | unset (disabled) | Opt-in session-badge steady poll (ms)                              |
| `COOKIE_DOMAIN`               | unset            | Server-only; cookie domain used when the proxy clears auth cookies |

All of these are validated by `lib/env/env.client.ts` / `env.server.ts`, and there are no
hardcoded fallbacks. See [Configuration](../configuration/frontend.md).

The admin cookies (`adminAccessToken`/`adminRefreshToken`) are hardcoded in `proxy.ts` +
`client-auth-wrapper.tsx` for isolation — the API validates `X-Client-Type: admin` on login
and sets the matching cookie names.
