---
title: "ADR 042: Quick Sign-In with Demo Accounts on Mobile"
tags: ["adr", "mobile", "auth", "security", "dx"]
description: "Development builds of the Expo app offer one-tap sign-in as the seeded demo accounts, like the web login pages; the list is imported inside an `if (__DEV__)` branch that Metro removes from production bundles."
author: "Platform Team"
lastUpdated: 1793232000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 42
---

# ADR 042: Quick Sign-In with Demo Accounts on Mobile

## Status

Accepted (2026-10-09). Implemented (2026-10-09). Amended 2026-10-29: an internal test build can opt in
(see [the amendment](#amendment-2026-10-29--opting-a-test-build-in)).

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

## Amendment (2026-10-29) — opting a test build in

Testers installing an APK outside the store need the same quick sign-in. A release build now carries
the list when it is built with **`EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true`**. That is for internal test builds
only, never a store build.

- **The gate keeps its shape.** `loadBundledDemoAccounts()` in `apps/mobile/src/lib/env.ts` imports the
  list inside `if (__DEV__ || process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNT === "true")`. In a release bundle
  Expo inlines the variable as a string (or `undefined` when it is unset), and `__DEV__` becomes
  `false`. Without the flag Metro therefore folds the test to `false` and removes the branch, the
  import and the passwords, as before.
  - **Verified:** `expo export --platform android --no-bytecode` with the flag unset, or empty,
    contains no demo password, and with `=true` it contains them.
  - **Why the gate is in `env.ts`:** it is the only file allowed to read `process.env`, and the test
    has to sit next to the import for Metro to fold it.
  - **Why the list moved:** to `src/lib/demo-account-list.ts`, so that `lib` does not import a
    context. `src/contexts/identity/auth/demo-accounts.ts` keeps `useDemoAccounts` and re-exports the
    `DemoAccount` type.
- **Only the exact word `true`** turns it on. `false`, blank or unset leave it off. Any other value
  is a configuration error: `resolveMobileEnv` checks the variable with the others, so a typo such as
  `yes` shows the configuration error screen instead of silently hiding the buttons. The gate itself
  still compares the literal, because Metro can only fold a literal `process.env` read.
- **The "Alternatives" entry above still holds.** The accounts never live *in* an `EXPO_PUBLIC_`
  variable. The variable only says whether the list file is bundled.
- **Consequence:** an APK built with the flag contains the seeded passwords, readable by anyone who
  unpacks it. Never set it for a build that leaves the team, and never in an EAS `production` profile.
