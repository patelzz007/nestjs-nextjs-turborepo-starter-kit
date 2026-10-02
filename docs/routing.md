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
| Detail pages in the path | `/merchants/[organizationId]`; query strings only for in-page selection or filters (`?key=`, `?page=`) |
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
  `/rewardhub/activity`, `/rewardhub/account`.
- **admin** — grouped by domain: `/analytics/sales` (`?weeks=` period filter), `/users` (+ `/[id]`, `/mfa-recovery`), `/merchants`
  (+ `/invites`, `/verification`, `/store-requests`), `/rewards/review`, `/emails/{templates,log}`,
  `/geography`, `/catalog/{products,categories}`, `/settings/{billing,access}` (platform),
  `/account/{profile,security}` (personal). Full table: [Admin panel](./admin-panel.md).
- **merchant** — org-scoped under `/orgs/[orgSlug]`: `dashboard`, `rewards` (`new`,
  `[rewardId]/edit`), `redemptions`, `analytics`, `terminals` (POS terminal pairing), `api-keys`, `settings` (organization index:
  `team`, `locations`, `verification`), `account` (personal). Top-level entry points: `/` and `/account` resolve the organization
  server-side; `/onboarding`, `/team-invite`, `/auth/*` (login, forgot-password, reset-password — the
  same paths as every app, from `APP_LINKS.auth`).

## Route authorization (merchant)

Every page under `apps/merchant/app/orgs/[orgSlug]/` has exactly one entry in
`ORG_PAGE_RULES` (`apps/merchant/lib/navigation/org-route-authorization.ts`): a `merchant:*`
capability requirement, or `open` with a written reason (`/` redirect, `/account`). Each page
calls `guardOrgPage(orgSlug, "<route>")` on the server before loading data and returns the
access-denied state when the membership in that organization lacks the capability, so typing a
URL never bypasses what the sidebar hides. The command palette and pinned items filter through
the same map, and the sidebar JSON must carry the same requirement for the same URL. A guard
test fails when a page is added without a rule or without the guard call. Details:
[Frontend authorization §5](./authorization-system/frontend.md#5-merchant-app-appsmerchant).

Old URLs were removed without redirects (hard cut) when this standard was introduced.
