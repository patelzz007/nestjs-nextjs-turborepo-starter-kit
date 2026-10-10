---
title: "ADR 044: Mobile Motion, Navigation Theme and the Launch Moment"
tags: ["adr", "mobile", "ui", "motion", "navigation", "tokens"]
description: "The navigators take their colours from the design tokens (no white flash in dark mode), tabs cross-fade on the tokens' emphasized curve, the menu button lives in the (app) layout, and the launch screen animates the brand mark."
author: "Platform Team"
lastUpdated: 1791590400000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 44
---

# ADR 044: Mobile Motion, Navigation Theme and the Launch Moment

## Status

Accepted (2026-10-10). Implemented (2026-10-10).

## Context

On a device, three things felt unfinished:

- In dark mode a white frame flashed on every navigation.
- Switching tabs used the library's generic "shift".
- The drawer's menu button was drawn by each screen, so it re-mounted on every page change.

The launch screen also showed a still mark.

## Decision

- **The navigators use the token colours.** React Navigation paints its screen containers, cards
  and transition backdrops white unless given a theme; that was the flash.
  - `NavigationThemeProvider` (`src/runtime/navigation-theme.tsx`) wraps the root guard. It takes
    React Navigation's light or dark base, following the theme Uniwind resolved (System, Light or
    Dark), with `background`, `card`, `text`, `border`, `primary` and `notification` from the
    tokens' CSS variables.
  - It also paints the native root window the page colour (`expo-system-ui`).
  - The `(auth)` stack gets the same theme with `background` set to `card`, because its screens
    sit on the card-coloured sheet.
- **Tabs cross-fade with a short drift.** `TAB_TRANSITION_SPEC` and `tabSceneStyle`
  (`src/lib/screen-transitions.ts`) are 260 ms on the tokens' `ease-emphasized-enter` curve
  (`MOTION` in packages/tokens): the outgoing tab fades out and the incoming one fades in, drifting
  16 pt toward the side it sits on.
  - With Reduce Motion on, the drift is dropped and tabs dissolve in place.
  - The setting is read synchronously (`reduce-motion-setting.ts`) inside the interpolator, never
    as layout state. Re-rendering the tab navigator mid-switch restarts its transition and cancels
    the tab reset (`popToTopOnBlur`) that runs when the transition ends.
  - Stack pushes stay native (`ios_from_right` on both platforms) and root changes stay a fade.
- **The menu button belongs to the `(app)` layout.** `AppMenuButton` → `CornerButton` is rendered
  once above every tab and never re-mounts. It fades (180 ms) on a tab's first screen and away
  deeper in a stack.
  - Screens learn the corner is taken from `ScreenCornerProvider` and move their title over.
    `Screen` no longer takes a `cornerAction`.
  - The pathname is read in a small `ScreenCornerScope`, not in the layout component, for the same
    reason as above: the tab navigator must not re-render on navigation.
- **The launch moment.** `LaunchScreen` starts as exactly the native splash's still mark, then:
  1. The cube's three faces part 7 pt along the cube's own axes and spring back together.
  2. The mark lifts 44 pt and the name and tagline fade up beneath it, on `ease-emphasized-enter`.
  3. While start-up continues, light travels around the cube: each face dims slightly as the light
     moves past (an 18% swing, a 2.4 s cycle). Its strength fades in once, so the loop has no
     visible start.

  Each face is its own layer, animated on the UI thread. With Reduce Motion on, it lands
  composed, with no movement and no loop.

## Alternatives

- **`contentStyle` on every navigator:** this misses cards, overlays and the native window, and
  repeats the colour in many places. A theme covers them all.
- **Switching tab animation off via a `useReduceMotion` hook in the layout:** this re-renders the
  navigator when the OS answers, which broke the tab reset (found by the tests).
- **Assembling the cube from scattered faces at launch:** it breaks the hand-off from the native
  splash, which shows the finished mark.

## Consequences

- Any navigator added later inherits the token colours. A screen that paints a different surface
  (like the auth sheet) overrides the theme's `background` for its own stack.
- Anything that changes over time (pathname, OS settings) must not re-render the tab navigator.
  Read it in a child component or outside React.
