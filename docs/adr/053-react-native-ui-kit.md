---
title: "ADR 053: The React Native UI Kit — packages/ui-native, the Web Kit's Twin"
tags: ["adr", "mobile", "ui", "architecture", "testing"]
description: "Low-level React Native components move out of apps/mobile into a shared package, @workspace/ui-native, named like the web kit and held to one mechanical contract (forwardRef, memo, CVA variant/size/state, tokens only, its own test); both kits get a live Components gallery, and every front-end test now lives in a __tests__ folder."
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
order: 53
---

# ADR 053: The React Native UI Kit — packages/ui-native, the Web Kit's Twin

## Status

Accepted (2026-10-16).

## Context

The mobile app's primitives (buttons, inputs, sheets, badges, date pickers) lived in
`apps/mobile/src/components`, mixed with the app's own composites (app shell, drawer, charts,
GitHub views). A second mobile app would have had to copy them. They were also uneven against
rules/07: most did not forward refs, none used CVA or a `state` axis, and many built objects in
JSX on every render. The web kit (`packages/ui`) had about 70 primitives with no mobile
counterpart.

## Decision

- **A separate package, `@workspace/ui-native` (`packages/ui-native`).** It sits beside
  `@workspace/ui` and is not merged into it.
  - The two kits have disjoint runtimes: React Native, Reanimated and Uniwind, versus the DOM,
    base-ui and Next.
  - They have disjoint lint boundaries: mobile code may not import `@workspace/ui`.
  - Splitting `packages/ui` into web and mobile folders would have renamed every web import for no
    gain.
- **The kit has no app knowledge.** Generic components and their pure libraries moved over from
  the app (`calendar`, `haptics`, `motion`, `use-reduce-motion`, `keyboard-avoidance`,
  `skeleton-sweep`, `use-pulse-style`). App composites stay in `apps/mobile/src/components`.
- **Same names as the web.** Where a web component has a mobile counterpart, both use one name:
  Banner became `Alert`, StatusPill `StatusBadge`, ConfirmDialog `AlertDialog`, and
  DataTable `Table`. The README's map lists the few mobile forms of desktop patterns
  (`DropdownMenu` as an action sheet, `Tooltip` on long-press) and what is web-only.
- **Native modules are peer dependencies.** Reanimated, SVG, Uniwind and the Expo modules are
  peers. The app provides the one copy, and its Metro and Jest resolvers list them as singletons.
  The app's Uniwind stylesheet adds `@source` for the kit, because Tailwind does not scan outside
  the app.
- **One contract, enforced mechanically** (packages/ui-native/README.md):
  - Every exported component is `React.memo(React.forwardRef(…))`.
  - It styles itself through CVA with `variant`, `size` and `state`. The `state` comes from
    `resolveControlState`, with the web's `resolveFieldState` precedence.
  - It uses the standard `onChange`, `onBlur` and `onFocus` contract.
  - Design tokens only: no arbitrary values, no hex colours, no `style={{…}}` literals.
  - It has its own test.
  - `packages/tooling/tests/ui-native-kit-contract.test.mjs` checks every component file. It lives
    in tooling because the kit's lint forbids Node built-ins.
- **Tests run on jest-expo, like the app** (ADR 031). This is the one exception to Vitest.
- **Live galleries.** The admin's `/components` page shows `packages/ui`. The mobile Settings →
  Components screen (drawer: Developer) shows `packages/ui-native`. Both are sample content with
  no API calls.
- **Tests live in `__tests__/` folders** beside the code, in web, admin, merchant, docs, mobile and
  ui-native (rules/11).
  - The test runners only collect `__tests__/`.
  - `packages/tooling/tests/test-placement.test.mjs` fails the build on a misplaced test, so a
    test never silently stops running.
  - Mobile route tests mirror the route tree in `src/__tests__/app/`, because Expo Router bundles
    every file under `src/app`.

## Consequences

- **A new mobile app** depends on `@workspace/ui-native`. It adds the `@source` line and the
  singleton resolver entries, and gets the whole kit.
- **New primitives** must pass the contract check and add a gallery demo.
- **The web kit's own audit against the same contract** (some of its components use arbitrary
  values) is a separate, follow-up task.
