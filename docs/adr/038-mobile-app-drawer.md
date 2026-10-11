---
title: "ADR 038: The Mobile App Drawer"
tags: ["adr", "mobile", "ui", "navigation"]
description: "The Expo app's (app) group gets a left drawer — a custom Reanimated panel over a scrim, opened from a quiet corner button or an edge swipe — holding the account, the tabs and the screens under Settings."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 38
---

# ADR 038: The Mobile App Drawer

## Status

Accepted (2026-10-09). Implemented (2026-10-09). Amended (2026-10-10): the scrim blurs the app — see
"Blurred scrim" below.

## Context

The floating tab bar (ADR 036) covers the four main destinations. The account and preference
screens (Security, Signed-in devices, Appearance, App lock) were two taps deep under Settings, and
the product wanted a drawer menu that slides in from the left. There must be no top bar. The app
must keep running in Expo Go, and every colour must come from the tokens (ADR 030).

## Decision

- **A custom drawer, not `expo-router/drawer`.** `src/components/drawer.tsx` is a presentational
  panel over a `--scrim`, animated by Reanimated with `PANEL_SPRING` (critically damped, clamped
  and following Reduce Motion). Gestures use React Native's `PanResponder`: a drag from the left
  edge opens the drawer, and a leftward drag on the panel closes it. The release rules are pure
  functions in `drawer-gesture.ts`. The drawer also closes from the scrim, the Android back button
  and the screen reader's escape gesture. While it is open, the app underneath is hidden from
  screen readers and the panel is `accessibilityViewIsModal`. No navigation dependency is added.
- **Opened from a quiet corner button, with no top bar** (since ADR 044, rendered once by the `(app)`
  layout, not by each screen). `Screen` takes a `cornerAction`: a 44pt
  round button fixed at the top-left. It uses the page's own background colour, slightly
  translucent, with a hairline border and no shadow, so it reads as part of the page. Content
  scrolls under it, and the screen title moves over to sit beside it. Each tab's first screen
  passes `useAppMenuAction()`. The edge swipe works only on a tab's first screen, because deeper
  in a stack that edge means "back".
- **Open state lives in a feature store** (`src/features/app-drawer`, ADR 023), provided by the
  `(app)` layout. Signing out unmounts the layout, so the drawer starts closed next time.
- **Contents** (`src/features/navigation/app-drawer.tsx`, menu data in `drawer-destinations.ts`):
  - A solid `primary` account header with the avatar (inverse tone), the name in Bricolage, the
    email and "Edit profile".
  - Below the header, a plain list on the panel's card surface, with no tiles or cards:
    - The four tabs, with no dividers between them.
    - An "Account" section (Security, Signed-in devices) and a "Preferences" section
      (Appearance, App lock, each showing its current value).
    - Each section opens with a full-width divider and a tone dot before its title (blue and
      violet), the same section marker the web sidebars use (`packages/ui`
      panel-sidebar-section-header).
    - The current screen's row is a solid `primary` capsule, inset from the panel's edges: slate
      with white text in light mode, white with slate text in dark mode. This matches the web
      sidebars' active row and the selected tab.
  - A destructive "Sign out" row below a divider, and the app version.
  - Tabs are switched to. Other screens are pushed onto their tab's stack.
  - Two-factor authentication is reached through Security, because its own route is an
    enrollment flow.
- **One sign-out flow.** `useSignOutConfirmation()` and `SignOutDialog` (`src/features/auth`) serve
  both Settings and the drawer, with the same wording and pending state.
- **Tabs reset when left** (`popToTopOnBlur`), and the Settings stack always has Settings as its
  first screen (`unstable_settings.initialRouteName`). Coming back to a tab shows its first screen,
  and a sub-screen opened from the drawer goes back to Settings.

## Alternatives

- **`expo-router/drawer` (React Navigation drawer):** native-quality gestures for free, but it adds
  `react-native-gesture-handler` and `@react-navigation/drawer`, and its chrome must be restyled to
  the tokens. Chosen against so the app keeps full control of the look.
- **A top bar with a menu button:** rejected by product, no top bar.
- **A menu button beside the floating tab bar:** tried, but the product wanted it at the top.

## Consequences

- `PanResponder` gestures run on the JS thread (the panel itself animates on the UI thread). Under
  heavy JS load a drag can lag. Moving to `react-native-gesture-handler` later only changes
  `drawer.tsx`.
- Gestures are covered by unit tests of `drawer-gesture.ts`, not by simulated touches. Check
  swipes on a device, on iOS and Android.

## Blurred scrim (amendment, 2026-10-10)

- Behind an open drawer the app is **blurred** as well as dimmed: an `expo-blur` `BlurView`
  (included in Expo Go, installed with `npx expo install`) with the `dark` tint at intensity 18,
  under the `--scrim` dim, which drops to 25 % since the blur already sets the app back.
- The blur follows the panel's progress, differently per platform:
  - **Android fades a fixed blur** (the wrapper's opacity follows the progress). Changing the blur
    radius every frame is too slow there; fading is a cheap alpha change.
  - **iOS animates the intensity** (Reanimated animated props, starting from 0). iOS renders a blur
    inside a view with alpha below 1 incorrectly, so it cannot be faded.
- `DrawerBlur` is memoized and its props never change while mounted. Every render of expo-blur
  re-sends its JS `intensity` to the native view, overriding the animated value for a frame — which
  showed as a flash of blur when the drawer started closing. Jest cannot reproduce that native
  override (Reanimated's Jest fallback re-applies animated values after each render), so it is
  checked on a device.
- It is mounted only from the moment the drawer opens (or an opening edge drag starts) until a
  close has settled, so a closed drawer keeps no blur view rendering behind the app.
- Android blurs only with an explicit method: the app sits in a `BlurTargetView` the `BlurView`
  reads, with `dimezisBlurViewSdk31Plus` — a real blur on Android 12+, the dim alone on older
  versions, where the blur is too slow.
- Under Jest, `expo-blur` is a boundary stand-in (`test/expo-blur-mock.tsx`): plain views, so the
  real Reanimated and drawer code run. The blur's look is checked on a device.
