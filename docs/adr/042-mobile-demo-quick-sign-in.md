---
title: "ADR 042: Quick Sign-In with Demo Accounts on Mobile"
tags: ["adr", "mobile", "auth", "security", "dx"]
description: "Development builds of the Expo app offer one-tap sign-in as the seeded demo accounts, like the web login pages; the list is imported inside an `if (__DEV__)` branch that Metro removes from production bundles."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 42
---

# ADR 042: Quick Sign-In with Demo Accounts on Mobile

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The web, merchant and admin login pages offer one-click demo accounts in development. The server
decides per request (`resolveDemoAccounts`) and imports the list lazily, so it never reaches a
production bundle. The phone needed the same buttons for Super Admin, Admin, Manager, the KL and
Melaka owners and a KL cashier. All of them sign in through the same `/auth/login` endpoint; the
web portals only differ by a cookie-isolation header. The phone has no server to keep the
passwords off the client.

## Decision

- **The bundle is the gate.** `loadDemoAccounts()` (`src/features/auth/demo-accounts.ts`) imports
  `demo-account-list.ts` only inside `if (__DEV__)`. Metro replaces `__DEV__` with `false` in a
  production bundle and drops the branch, and the import with it, before collecting dependencies.
  A store build therefore contains neither the list nor its passwords.
  - **Verified:** `expo export --platform ios --no-bytecode` contains the sign-in screen's strings
    and none of the demo emails or passwords.
  - Hermes bytecode cannot be searched as text, so `--no-bytecode` is required for that check.
  - Rules: `__DEV__` stays a literal, and the list is never imported at the top level of any
    module.
- **The same behaviour as the web.** A "Quick sign-in (development)" block under the sign-in
  button has one button per account. Pressing one fills the email and password, so the user sees
  what is sent, and signs in through the normal flow: two-factor, new-device verification and
  forced enrollment all still apply. `QuickSignIn` is presentational and never sees a password.
- **Jest runs the real import.** `babel.config.js` keeps Expo's preset and adds
  `@babel/plugin-transform-dynamic-import` under the `test` environment only. Metro bundles
  `import()` itself; Jest needs it rewritten.

## Alternatives

- **An `EXPO_PUBLIC_` variable holding the accounts:** it is inlined into every bundle, production
  included.
- **A development-only API endpoint that lists the accounts:** it adds a server surface just for
  this, and the passwords would still reach the device.
- **A top-level import with a runtime check:** the passwords would ship in every build.

## Consequences

- The seeded credentials are listed per client (web, merchant, admin, mobile), as before. A seed
  change must update each list.
- Any future development-only data on mobile follows the same pattern: imported inside
  `if (__DEV__)`, and verified with a `--no-bytecode` export.
