---
title: "ADR 023: Client State as NgRx-Style Zustand Feature Stores"
tags: ["adr", "frontend", "state", "zustand", "tanstack-query", "nextjs"]
description: "Shared browser state lives in per-feature Zustand stores built like NgRx — named actions, a pure reducer, effects, selectors and a facade — created per provider mount, never at module scope; server data stays in TanStack Query and shareable state in the URL."
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
order: 23
---

# ADR 023: Client State as NgRx-Style Zustand Feature Stores

## Status

Accepted (2026-10-02). Guide: [rules/06](../../rules/06-tanstack-state-forms-tables.md#zustand-feature-stores--the-house-pattern).

## Context

The three Next.js apps already used Zustand, but every store was different. Each one went
wrong in at least one of these ways:

- **Module-level singletons**, which rules/06 forbids because one server process serves many
  requests.
- **Free-form action names** such as `"toggle"`.
- **Whole-store subscriptions.**
- **Server or URL state copied into Zustand.** Examples: the compiled sidebar menu (static
  config), the current page (URL state), and the merchant's store filter, which was held in a
  cookie, two `useState`s and a derived default all at once.

The team knows Angular/NgRx and wants that model's debuggability: a readable Redux DevTools
timeline and one obvious place for each kind of logic. It does not want an RxJS runtime inside
React.

## Decision

1. **One owner per value.**

   | Value | Owner |
   |---|---|
   | Server data | TanStack Query |
   | Shareable, bookmarkable or SSR-relevant state (table search, sort, page, filters, route ids) | The URL |
   | Shared browser state (sidebar, command palette, display preferences, the merchant's current store, the tab's session status) | A Zustand feature store |
   | Single-component state | `useState` |
   | Authentication and authorization | The API, with PostgreSQL RLS behind it |

   Client state is never a security boundary.

2. **A feature store is built like NgRx, not with NgRx.** Shared toolkit:
   `packages/client/src/lib/state`.
   - **Actions** are a discriminated union whose `type` reads `[ Feature ] Event`.
   - **The reducer** is pure: no I/O, no browser APIs, no time.
   - **Effects** run after the reducer and are the only place that touches the outside world
     (cookies, navigation, query invalidation). Their dependencies are closed over when the
     store is created.
   - **Selectors** are narrow; derived values are computed, never stored.
   - **The facade** is a narrow hook per value plus a commands hook with stable identities.
     It is the only module components import.
   - **Redux DevTools** runs in a development browser only. It records `{ type, payload }`.

3. **Store lifetime.** `createFeatureStoreContext` creates the store once per provider mount:
   once per request on the server and once per tab in the browser. Providers sit at a
   persistent layout boundary, so client navigation keeps the state. A full reload resets it
   unless the feature opts into persistence.

4. **Deliberate persistence.**
   - `connectFeaturePersistence` restores a zod-validated snapshot after mount (so there is no
     hydration mismatch), using the feature's own `… Restored` action so it shows in DevTools.
   - It writes back only the selected slice.
   - Untrusted or garbled storage is ignored.
   - Snapshots written by an older format are upgraded by the schema rather than discarded.
     A stored value that is not JSON (an older helper's bare string, such as `list`) is
     handed to the schema as the raw string, so the schema alone decides whether to
     upgrade it.

5. **Placement.** The toolkit and features shared by several apps (sidebar, command palette,
   UI preferences, auth) live in `packages/client/src/lib`. A feature used by one app lives in that app's
   `features/` folder (merchant `tenant-context`). `packages/ui` stays presentational and
   store-free.

## Consequences

- **Pros.** Every shared-state change is a named, inspectable event. Reducers and selectors are
  pure functions with plain unit tests. No state leaks between server requests.
- **Cons.** A feature now spans several small files. For state one component owns, use
  `useState` instead; this pattern is for state that is genuinely shared.
- **What moved where.**
  - The sidebar menu is now a static constant in each app, and the current page is read from
    `usePathname()`.
  - Breadcrumb resolvers no longer reach into a store with `getState()`.
  - The three per-app command palette singletons (`apps/*/stores/command-palette-store.ts`)
    became one shared `command-palette` feature, mounted in each shell next to the sidebar
    provider, with the same storage keys.
  - Existing persisted preferences carry over, because the legacy `zustand/persist` envelope
    is accepted and upgraded.
  - The merchant's store filter is the `tenant-context` feature store. Its state is only the
    member's choice. The accessible stores come from the organization-context query, the URL
    owns the organization, and a cookie effect mirrors the choice so server pages prefetch the
    same store ([Frontend routing](../routing.md#organization-and-store-context-merchant)).
  - The client auth singleton (`useAuthStore`, `lib/auth/session/store.ts`) became the
    shared `auth` feature (`packages/client/src/lib/features/auth`). The store holds only
    the session status (`unknown` / `authenticated` with subject id and scope / `signed-out`
    with a reason) and a session epoch. The profile stays in the `/auth/me` query, and a
    sign-in seeds that query from the login response. Its effects clear the query cache on
    every way of losing the session and on every identity change, and notify other tabs.
    `useAuth()` remains the facade, and new code uses `useAuthUser()`,
    `useIsAuthenticated()`, `useAuthStatus()` and `useAuthCommands()`. A session check
    that cannot reach the API is not a fact about the session: it changes only a separate
    `check` slice (`ok` / `retrying` / `paused`, read with `useSessionCheckStatus()`), never
    the status or the cache, and retries with bounded backoff. The `/auth/me` →
    `login()` re-syncs in the web shells and `AuthSessionBootstrap` were removed. The
    cookies and the API remain the only authority
    ([Token refresh](../token-refresh.md#client-session-state-the-auth-feature-store)).
  - The two rewards grid/list helpers (web `lib/rewards/view-mode.ts` with
    `use-view-mode.ts`, merchant `lib/rewards/view-mode.ts` with
    `use-merchant-rewards-view-mode.ts`) became one shared `ui-preferences` feature
    (`rewardsViewMode`). Merchant mounts it in its shell. Web mounts it in the root layout,
    because the public landing page renders the catalog outside the `/rewardhub` shell.
    The storage keys are unchanged, and the bare `grid`/`list` string the helpers wrote is
    upgraded. The web helper read storage during the first render, which could make the
    client HTML differ from the server's; the store restores after mount instead.
  - Admin table state moved from `useState` into the URL. This covers search, filters,
    sort, page, page size and the keyset cursor in users, merchants, products, categories,
    the email log, geography (plus `?tab=`) and the MFA recovery queue. Each table declares
    its params once with `defineUrlState` (`packages/client/src/lib/url-state`, declarations
    in `apps/admin/lib/url-state`), using the list grammar's own keys, so a URL maps 1:1
    onto the API request. The server page parses the same declaration and prefetches the
    requested page. Geography used to prefetch only its stats and fetch its rows on the
    client. It now prefetches the active tab's page as well, tagged with its tab
    (`GeoTabPage`). The table reads the URL state with `useUrlState` and writes it through the History
    API without a server round trip: discrete changes push a history entry, debounced
    typing replaces it. The search box's in-progress draft is the only local state left
    (`useUrlDraft`). `useManualHybridPagination` and `useDebouncedValue` were removed
    ([List queries §7](../list-queries.md#7-table-state-in-the-url)).
  - In-page selections are derived from the URL instead of being mirrored into
    `useState`: the KYB review's `?organizationId=`, the email template's `?key=` and the
    MFA recovery and store-request queues' `?requestId=`. The KYB panel used to keep a copy
    in `useState`, so back/forward did not resync it. The template browser read `?key=`
    but never wrote it back.
  - Web and merchant list state moved from `useState` into the URL the same way. The web
    catalog (`/rewardhub` and the public landing `/`) keeps search, city, category and page in
    the URL; its cursor history in `useState` is gone, so Back now walks through pages and
    filters. The merchant redemption log gained `?page=` paging (it only ever showed the newest
    page), and the API-keys filter is `?status=`. The store stays in `tenant-context`; the
    redemptions prefetch is bound to both the store and the URL state. The grid/list layout
    stays in `ui-preferences`. `toPrefetchedQuery`/`prefetchedDataFor` moved from admin to
    `packages/client/src/lib/url-state/prefetched-query.ts` now that three apps use them, and
    the page-move rule became `listPagePatch`
    ([List queries §7](../list-queries.md#which-pages-keep-their-state-in-the-url)).

## Alternatives considered

- **NgRx-style RxJS effects (`Actions$`):** rejected. It means an observable runtime and a
  registry to maintain, with no gain over plain functions in React.
- **Redux Toolkit:** viable, but heavier than needed. Zustand was already in place and gives
  the same DevTools timeline.
- **Jotai:** atom composition does not give the action timeline the team wants. Two client-state
  libraries would also be one too many.
