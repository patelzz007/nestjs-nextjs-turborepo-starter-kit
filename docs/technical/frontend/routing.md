---
title: "Frontend Routing — URL Conventions"
tags: ["routing", "navigation", "sidebar", "nextjs"]
description: "URL conventions shared by the web, admin and merchant apps, where each app's routes live, how cross-app links (emails, invites) stay in sync, and how the sidebar's active item follows the URL."
order: 17
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Frontend routing (web, admin, merchant)

URLs are part of the product: they drive the sidebar's active item, breadcrumbs, route
authorization, the proxy, the command palette, and links in emails. These rules keep them
consistent across the three Next.js apps.

## Conventions

| Rule | Example |
|---|---|
| Plural, kebab-case nouns | `/merchants/store-requests`, never `/product` or `/storeRequests` |
| CRUD shape | list `/x` · create `/x/new` · detail `/x/[id]` · edit `/x/[id]/edit` |
| A section owns a prefix | Sidebar parent "Merchants" is `/merchants`; its children live under it |
| Parent URL = section prefix | never a child's URL (the parent must prefix-match every child) |
| No duplicate menu URLs | two enabled items never share a URL — one exception: a section's "All …" leaf may share the section prefix, because parent rows only expand/collapse (the deeper leaf wins the highlight) |
| Section index | exists — a page, or a redirect to its default child (`/settings` → `/settings/billing`) |
| Detail pages in the path | `/merchants/[organizationId]`; query strings only for in-page selection or filters (`?key=`, `?page=`), declared with `defineUrlState` and read with `useUrlState`, never mirrored into `useState` ([List queries §7](../api/list-queries.md#7-table-state-in-the-url)) |
| Personal vs configuration | `account` = the signed-in user's profile, password, 2FA, sessions; `settings` = org / platform configuration |

## Where routes live

- **Each app owns its routes** in `apps/<app>/lib/routes.ts` — typed static paths and builders
  (`ROUTES.users.detail(id)`). Every internal link, `router.push`, `redirect`, proxy list,
  route-authorization rule, palette entry and breadcrumb uses it — no hand-typed paths.
- **The sidebar** stays data (`*-sidebar-menu.json`) with the same URLs; guard tests in each app
  fail when an enabled menu URL has no page, two enabled items share a URL, or a child is not
  under its parent.
- **Paths that cross an app boundary** — the API builds them into emails and invite links — live
  once in `@workspace/shared` `APP_LINKS` (`packages/shared/src/app-links.ts`), and the apps'
  `routes.ts` reuse those constants. Rename such a page and both change together.
- **Breadcrumbs** come from the sidebar menu (`resolveSidebarMenuTrail`); below the deepest menu
  match, each app's `resolvePage` decides which URL segments are real pages (others — like the
  id in `/rewards/<id>/edit` — produce no crumb). A data-driven page names its final crumb with
  the breadcrumb context's `setTailLabel(name)`; labels are scoped to the pathname they were set on.
  When the page's data has no entity name, its static crumb label matches the page heading (web's
  wallet claim page reads `My Wallet › Show at checkout`), and back links use the parent crumb's name.
- **Active sidebar item**: segment-aware prefix matching (`packages/ui/src/lib/sidebar/menu-view.ts`)
  — with the conventions above, the deepest matching item is the right one by construction.

## Per-app structure

- **web** — public: `/`, `/rewards/[rewardId]`, `/auth/*`. Signed-in shell under `/rewardhub`
  (browse), `/rewardhub/rewards/[rewardId]`, `/rewardhub/wallet[/[claimId]]`,
  `/rewardhub/activity`, `/rewardhub/account`. The catalog on `/rewardhub` and on `/` keeps its
  search, filters and page in the query string (`?search=&filter[city]=&filter[category]=&page=`);
  the wallet keeps its page there (`/rewardhub/wallet?page=&cursor=`).
- **admin** — grouped by domain: `/analytics/sales` (`?weeks=` period filter), `/users` (+ `/[id]`, `/mfa-recovery`), `/merchants`
  (+ `/invites`, `/verification`, `/store-requests`), `/rewards/review`, `/emails/{templates,log}`,
  `/geography`, `/catalog/{products,categories}`, `/settings/{billing,access}` (platform),
  `/account/{profile,security}` (personal). Full table: [Admin panel](./admin-panel.md).
- **merchant** — org-scoped under `/orgs/[orgSlug]`: `dashboard`, `rewards` (`new`,
  `[rewardId]/edit`), `redemptions` (`?page=`), `analytics`, `terminals` (POS terminal pairing), `api-keys` (`?status=` key filter), `settings` (organization index:
  `team`, `locations`, `verification`), `account` (personal). Top-level entry points: `/` and `/account` resolve the organization
  server-side; `/onboarding`, `/team-invite`, `/auth/*` (login, forgot-password, reset-password — the
  same paths as every app, from `APP_LINKS.auth`).

## Organization and store context (merchant)

The merchant's tenant is the **organization**; its **locations** are the organization's stores.
Each value has one owner:

| Value | Owner | Read it with |
|---|---|---|
| Active organization | The URL segment `/orgs/[orgSlug]` | `useOrganizationSlug()` (`useParams`), or the layout/page `params` on the server |
| Last opened organization | `organizationSlug` cookie, written **only** by `OrgTenantBootstrap` in the org layout (a guard test enforces this), cleared on sign-out (`useMerchantLogout`) | Server entry routes: `/`, `/account`, the org layout's fallback redirect — always matched against the user's memberships first (`resolvePreferredMembershipSlug`); the proxy only accepts a canonical slug for the enrollment redirect |
| Accessible stores | TanStack Query `api.organizations.context` (server state, never copied into Zustand) | The tenant-context facade |
| Chosen store (`null` = all stores) | Zustand feature store `apps/merchant/features/tenant-context`, mirrored by its effect to that organization's own `organizationLocationId.<orgSlug>` cookie (`Secure` on https origins, cleared on sign-out); the server keeps the cookie value only when it names a store the member may use. "All stores" is offered only to `ALL_LOCATIONS` members | `useActiveLocationFilter()`, `useMerchantLocation()`, `useTenantContextCommands()` |

- **Outside org routes** (`/auth/*`, `/onboarding`, `/team-invite`) there is no organization in the
  URL: `useOrganizationSlug()` returns `undefined`, and org-relative links (`useOrganizationPath`)
  point at the entry pages, which pick the organization on the server from the cookie.
- **Switching organization** (sidebar switcher, `useSwitchOrganization`) clears the store cookie and
  `router.push`es to the other organization's dashboard. The tenant-context provider is keyed by the
  slug, so the new organization starts with a fresh store.
- **The effective store is derived**, never stored (`resolveEffectiveLocationId`): a stored choice
  the member can still access wins; otherwise "All locations" when the member has more than one store,
  else their only store. While the stores are still loading, the stored choice is used as is.
- **No double fetch.** The org layout calls `loadServerLocationScope(orgSlug)` (cookie + organization
  context, memoized per request) and seeds the provider with the cookie value and the context. Pages
  that prefetch (`analytics`, `redemptions`, `terminals`, `api-keys`) fetch with the same scope's
  `effectiveLocationId`. They pass the data as `LocationScopedPrefetch` (`{ locationId, data }`). The
  view seeds `initialData` only when that `locationId` equals the client's filter
  (`prefetchForLocation`). A page with URL state as well (`redemptions?page=`) binds the prefetch to
  both, `LocationScopedPrefetch<PrefetchedQuery<…>>`, and also checks the serialized URL state
  ([List queries §7](../api/list-queries.md#store-scoped-lists-merchant)). The store itself never moves
  into the URL. Server and client run the same derivation on the same inputs, so the
  first client render asks for the key the server filled.
- **Changing store needs no invalidation.** Every location-filtered query has `locationId` in its key.
  A new store is a new key and is fetched when needed; the previous store's entries stay cached, so
  switching back is instant.
- **Never a security boundary.** The cookie is client input. The server only checks that it is a UUID,
  and the API re-validates every `locationId` against the membership on every request. "All locations"
  sends no `locationId`, which the API resolves to the member's own stores (every store only for an
  all-stores member) — omitting the filter never widens a store-limited member's view.

## Server page guard and failed prefetches (web)

Every signed-in web page (everything under `/rewardhub`, and `/hello`) calls
`await guardWebPage("<its own path>")` (`apps/web/lib/auth/page-guard.ts`) before it fetches or
renders. Without both session cookies (access + refresh) it redirects to
`/auth/login?redirect=<path>`; the login route's proxy refresh restores a refresh-only session and
sends the user back. It runs per page, not in the layout (layouts do not re-render on client
navigation), and it backs up the proxy rather than replacing it. A test scans `app/` and fails
when a protected page lacks the call.

A web server page awaits its API calls with `Promise.allSettled` and passes each result to
`settleServerQuery(result, { label, expected })` (`@workspace/client/lib/api/server-query-outcome`,
shared with merchant, whose `lib/server/server-query-outcome.ts` adds `prefetchedDataOrUndefined`).
A rejection that is not an `Error` is never treated as expected: it is rethrown with a synthetic `Error` as its cause.
The page lists the failures it renders on purpose: `unauthenticated` (401, no access cookie) →
`redirect(loginPath(path))`, `forbidden` (403) → the "Not available for your account" notice,
`not-found` (404) → `notFound()`. Any other failure (API down, timeout, 5xx, a response that breaks
its contract, or a status the page did not declare) is logged with the request label and rethrown,
so `app/rewardhub/error.tsx` (inside the shell), `app/error.tsx` or `app/global-error.tsx` (root
layout) renders it with a retry and the error digest. A detail page validates its `[id]` with the
endpoint's own input schema first, so a malformed id is a 404, not a server error. The URL-state
list pages (`/`, `/rewardhub`) keep the list convention instead: a failed prefetch is handed to the
client, which refetches and shows its own error state ([List queries §7](../api/list-queries.md)).

## Route authorization (merchant)

Every page under `apps/merchant/app/orgs/[orgSlug]/` has exactly one entry in
`ORG_PAGE_RULES` (`apps/merchant/lib/navigation/org-route-authorization.ts`): a `merchant:*`
capability requirement, or `open` with a written reason (`/` redirect, `/account`). Each page
calls `guardOrgPage(orgSlug, "<route>")` on the server before loading data and returns the
access-denied state when the membership in that organization lacks the capability, so typing a
URL never bypasses what the sidebar hides. The command palette and pinned items filter through
the same map, and the sidebar JSON must carry the same requirement for the same URL. A guard
test fails when a page is added without a rule or without the guard call. Details:
[Frontend authorization §5](../authorization/frontend.md#5-merchant-app-appsmerchant).

Old URLs were removed without redirects (hard cut) when this standard was introduced.
