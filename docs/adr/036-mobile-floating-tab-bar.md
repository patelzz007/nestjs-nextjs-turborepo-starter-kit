---
title: "ADR 036: Floating Tab Bar, Reanimated and Lucide on Mobile"
tags: ["adr", "mobile", "ui", "navigation", "motion"]
description: "The Expo app's tabs use a custom floating tab bar driven by Reanimated springs, Lucide icons shared with the web, a solid token-coloured surface instead of blur, and a placeholder Search tab."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 36
---

# ADR 036: Floating Tab Bar, Reanimated and Lucide on Mobile

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The `(app)` group used Expo Router's default bottom tabs with Ionicons (`@expo/vector-icons`).
The product wanted a floating, pill-shaped tab bar where the selected tab grows into a capsule
with its icon and label, plus a fourth tab, Search. The web already uses Lucide (`lucide-react`).
The app must keep running in Expo Go (ADR 032) and keep colours on design tokens (ADR 030).

## Decision

- **A custom `tabBar` on Expo Router's `Tabs`**, not `NativeTabs`. `NativeTabs` gives the
  system bar (Liquid Glass on iOS 26, a Material bar on Android), so the two platforms would
  look different and the bar could not be styled with tokens. The presentational bar is
  `src/components/floating-tab-bar.tsx`. The adapter that connects it to the navigator is
  `src/features/navigation/app-tab-bar.tsx`. It keeps React Navigation's `tabPress` contract, so
  pressing the current tab still pops a nested stack to its root.
- **One registry of tabs**, `src/features/navigation/app-tabs.ts`. The layout and the bar both read
  each tab's order, title and icon from it.
- **Reanimated 4 for motion.** Width, opacity and colour change on the UI thread. Built-in
  `Animated` cannot animate width with the native driver, and `LayoutAnimation` cannot be tuned
  per element. Springs are named in `src/lib/motion.ts`. `SELECTION_SPRING` is critically damped
  and clamps overshoot. A first, under-damped version overshot: the growing tab got briefly too
  wide and the shrinking one too narrow, so every neighbouring icon wobbled left and right before
  settling. Layout-driving springs must never overshoot. Every spring uses
  `ReduceMotion.System`.
- **Lucide (`lucide-react-native` on `react-native-svg`)** is the app's one icon set, the same
  glyphs as the web. Glyphs are imported one by one (`lucide-react-native/icons/house`) because
  Metro does not tree-shake. `@expo/vector-icons` is removed. `src/components/icon.tsx` gives one
  size scale and two stroke weights, and colours icons with `accent-*` token utilities via
  Uniwind's `colorClassName`.
- **Lucide has no filled icons, so the selected state is shown by weight and colour.** The selected
  tab has a solid `primary` capsule and a bold `primary-foreground` icon and label. Unselected tabs
  show a regular-weight `muted-foreground` icon.
- **A solid surface, not blur.** The bar is `bg-card` with a hairline border and `shadow-lg`.
  `expo-blur` is experimental on Android and costs performance. In dark mode, the elevation comes
  from the card's lighter tone.
- **Content clearance.** The bar floats over the screen. It reports its covered height through
  the navigator's `BottomTabBarHeightCallbackContext`, and `Screen` pads its scroll content and
  scroll indicator by `useTabBarClearance()`. Outside the tabs there is no padding.
- **Haptics (`expo-haptics`):** a selection tick when the tab changes, through
  `playSelectionFeedback()`.
- **The bar hides while the keyboard is open**, using `useKeyboardVisible()`.
- **Search is a placeholder.** There is no search source yet, so the tab shows a `ComingSoon`
  panel ("Back to home"). A product replaces `src/app/(app)/search.tsx` with real search.

## Alternatives

- **`NativeTabs`:** native Liquid Glass on iOS, but a different bar on Android and no token
  styling.
- **Built-in `Animated` or `LayoutAnimation`:** no new dependency, but width runs on the JS thread
  or cannot be tuned, so it stutters under load.
- **`expo-blur` glass surface:** experimental on Android.
- **Keep Ionicons:** a second icon set alongside the web's Lucide.

## Consequences

- New native-backed dependencies, all included in Expo Go: `react-native-reanimated`,
  `react-native-worklets`, `react-native-svg` and `expo-haptics`. A real build needs a store
  submission, not an OTA update, to add them.
- Under Jest, `react-native-worklets` is replaced by its own mock (`jest.setup.ts`), so the real
  Reanimated runs on the JS thread. `jest.resolver.cjs` loads Lucide's CommonJS build, because its
  React Native build is ES modules only.
- Animations and Uniwind classes on Reanimated views (`withUniwind(Animated.View)`) are not
  compiled under Jest. They must be checked on a device, on iOS and Android, and with Reduce
  Motion on.
