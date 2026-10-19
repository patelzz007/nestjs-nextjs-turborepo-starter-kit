---
title: "ADR 050: The Auth Store Starts From the Session the Server Rendered For"
tags: ["adr", "frontend", "auth", "ssr", "session"]
description: "Each app's root layout asks the API for the request's session (/auth/me + /auth/permissions) and the client auth store starts from that answer, so nothing that depends on who is signed in pops in after the page loads."
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop"
order: 50
---

# ADR 050: The Auth Store Starts From the Session the Server Rendered For

## Status

Accepted (2026-10-12). Implemented (2026-10-12).

## Context

On every reload, parts of the page that depend on who is signed in appeared a moment after the rest:

- admin: the super-admin-only **Users** menu item (missing from the server HTML and for the first ~8
  animation frames, measured in the browser);
- web and merchant: the super-admin impersonation panel and the account email;
- merchant: the enrollment lock on menu items for a restricted session.

All of them read `useAuth().user`. The client auth store started every page `unknown`, and `user` was
only composed once the browser's own session check (`/auth/me` + `/auth/permissions`) had answered —
after hydration. Capability-gated items did not flicker because their permissions were already
prefetched by the server; the profile (and with it `isSuperAdmin`) was not.

## Decision

The server asks the API about the request's session while it renders, and the client store starts from
that answer.

- **One loader** — `loadServerSessionOutcome` (`@workspace/client/lib/contexts/identity/session/load-server-session`)
  calls `GET /auth/me` and `GET /auth/permissions` in parallel with the request's cookies: the same two
  answers the browser's session check reads, validated against their contracts and verified by the API.
  It returns `signed-in` (both envelopes), `signed-out` (no cookie, or a 401 — possibly still refreshable
  by the browser; a server render cannot write cookies), or `unavailable` (an outage, logged, carrying
  the error).
- **Each app keeps its own outage policy.** Web rethrows `unavailable` to its error boundary, as its
  permissions prefetch already did. Admin and merchant render without a server session and let the
  browser's session check retry, as they already did.
- **Asked once per request.** Admin and merchant wrap the loader in `React.cache`. Admin's panel layout
  takes its permissions from the same answer instead of a second call, and still redirects a signed-out
  session to sign-in. Web's root layout feeds the same answer to both the auth store and its
  authorization provider, replacing `loadWebInitialSessionPermissions`.
- **The store is created in the confirmed state.** `AuthProvider` takes `serverSession`. `createAuthStore`
  passes it to the feature store as an initial action — `[ Auth ] Session Restored`, the session check's
  own transition — through a new `initialActions` option of `createFeatureStore`:
  - the actions are reduced into the store's **initial** state;
  - then they are handed to the effects once, which seed `/auth/me` and `/auth/permissions` in the query
    cache with the server's envelopes and real answer times.

  This is required, not a detail. Zustand's `useStore` reads `getInitialState()` during a server render
  and hydration, so a session dispatched after creating the store was invisible to the first paint. The
  first implementation did exactly that, and the item still flickered; a `renderToString` test now
  guards it.

- **The session stays the browser's to keep.** The restored session continues the server-rendered epoch
  (`useIsServerRenderedSession` stays true), and the on-mount session check still runs. A session that
  ended between the render and the check is signed out as usual, and a different identity starts a new
  epoch. The store reads `serverSession` once, at mount. Later sign-ins and sign-outs are the tab's own.

The answers are UI state only. Every API call is still authorized by the API.

## Alternatives

- **Decode `isSuperAdmin` from the access-token JWT on the server** (as `getServerUser` does for the
  name). Unverified, and it covers one flag rather than the whole user.
- **Add `isSuperAdmin` to `/auth/permissions`.** It fixes the admin item only. The impersonation panel,
  the account email and the enrollment lock read the whole user.
- **Hide session-dependent UI until the client knows** (skeletons, `isResolved` gates). That is the
  current behaviour made explicit, not fixed: the content still appears late.
- **Dispatch the session into the store after creating it.** Invisible to the server render and
  hydration (see above).

## Consequences

- Every full page load with a session makes two server-side API calls (`/auth/me`, `/auth/permissions`;
  both cached in Redis by the API). Admin no longer makes its separate permissions prefetch, and web
  replaces its permissions prefetch with the pair.
- The admin root layout is now dynamic (it reads cookies through the server caller).
- The on-mount session check still makes its two calls. The seeded queries do not refetch, because the
  server's answers are fresh. Skipping the check when a server session was given is a possible follow-up;
  it would change the refresh timing, so it is not part of this decision.
- `getServerUser` / `getMerchantServerSession` (identity decoded from the JWT for the shell's name and
  email) are now only a fallback for when the API was unavailable during the render.
- Pinned favourites are still read from the browser's storage after hydration. That is per-device
  browser state, not session state, and is not covered by this change.
