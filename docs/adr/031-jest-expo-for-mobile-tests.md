---
title: "ADR 031: jest-expo for the Mobile App's Tests"
tags: ["adr", "testing", "mobile"]
description: "The Expo app is tested with jest-expo and @testing-library/react-native, an explicit exception to the repo-wide Vitest standard; platform-neutral logic stays in shared packages under Vitest."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 31
---

# ADR 031: jest-expo for the Mobile App's Tests

## Status

Accepted (2026-10-08). Implemented (2026-10-09) in piece 5 of the mobile plan: `apps/mobile` runs
jest-expo `~57.0.5` (the `~57.0.2` floor avoids 57.0.0's install failure) on Jest 29 with
`@react-native/jest-preset` 0.86.3 and `@testing-library/react-native` 14 (async `render` /
`fireEvent` / `act`). Screens render inside Expo Router's test router with the real app runtime;
only `fetch`, the native modules and the theme engine are faked
([`rules/11`](../../rules/11-testing-vitest.md#the-one-exception-to-vitest-appsmobile-uses-jest-expo)).
`jest.resolver.cjs` mirrors Metro's two resolution rules (singleton React / React Native / TanStack
Query, `development` export of `@workspace/*`), so tests load exactly what the bundle loads.

## Context

`rules/11-testing-vitest.md` makes Vitest the test runner for the whole repository. React Native's
test tooling (Metro transforms, native module mocks, `@testing-library/react-native`) is built
around Jest through the `jest-expo` preset. Running React Native components under Vitest is
unsupported and fragile.

## Decision

- `apps/mobile` uses `jest-expo` with `@testing-library/react-native`. This is the only exception
  to the Vitest standard.
- Platform-neutral logic (schemas, contracts, the API client core, token generation) lives in
  shared packages and is tested with Vitest there. Mobile tests cover screens, hooks and
  mobile-only modules.
- The mobile `test` task runs under `pnpm run test` like every other workspace; the completion
  gate is unchanged.

## Alternatives

- **Vitest for React Native**: unsupported by the Expo toolchain; mocks for native modules would be
  hand-rolled.
- **No component tests on mobile**: violates "tests are written for everything".

## Consequences

- Two runners in the repo; contributors writing mobile tests use Jest APIs.
- Keeping logic in shared packages keeps most tests on Vitest.
