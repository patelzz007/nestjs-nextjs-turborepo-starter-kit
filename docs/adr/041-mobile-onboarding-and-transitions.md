---
title: "ADR 041: Mobile Onboarding and Screen Transitions"
tags: ["adr", "mobile", "ui", "navigation", "motion"]
description: "A first-launch walkthrough, built from React Native and Reanimated only, shown once per device by the root guard; and one named set of native screen transitions for every navigator."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 41
---

# ADR 041: Mobile Onboarding and Screen Transitions

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The app opened straight on sign-in. The product wanted a first-launch walkthrough with no
third-party carousel library. Screens also moved inconsistently: tabs switched with no animation,
and stacks used each platform's default (a slide on iOS, a fade-up on Android).

## Decision

### Onboarding

- **Shown once per device, by the root guard.** `onboardingCompleted` is a device preference in the
  preferences feature store, persisted in Secure Store (`prefs.onboarding.completed`) and restored
  before the session.
  - `resolveRootRoute` (`src/runtime/root-route.ts`) sends a **signed-out** device that has not
    finished onboarding to the `onboarding` route.
  - It never interrupts a signed-in, locked or restricted session, or the configuration and update
    screens.
  - Finishing or skipping only records the preference; the guard then moves the app to sign-in.
- **No library.** `OnboardingCarousel` (`src/components/onboarding-carousel.tsx`) is a paging
  `Animated.ScrollView`. Reanimated tracks its position on the UI thread and drives:
  - **Parallax:** each page's illustration drifts at 45% of the page's speed, fading and shrinking
    as it leaves; the text drifts a little.
  - **Page dots:** they stretch into a pill for the current page.
  - **Buttons:** "Next" scrolls programmatically, with no animation when Reduce Motion is on.
  - **Screen readers:** they hear "Step 2 of 3".
- **Theme tokens only, so it follows light and dark:**
  - The page background, foreground text, and card-coloured rings with accent chips.
  - A solid `primary` tile with the slide's mark (the brand mark, or a Lucide icon), and the
    primary button.
  - The bottom area is kept loose (`pb-8`) so the button is not crowded against the home
    indicator.
- **The slides** live in the screen (`src/app/onboarding.tsx`) and describe what the starter really
  does: the account, security (2FA, app lock, device sign-out) and personal preferences. Products
  rewrite them.
- **Replaying it.** The "seen" flag lives in the Keychain, which survives reinstalling the app on
  iOS. Development builds therefore show "Sign out and replay onboarding" in Settings → About.

### Screen transitions

`src/lib/screen-transitions.ts` names one transition per kind of move. All are native (UI thread)
and follow Reduce Motion.

| Move | Transition |
| --- | --- |
| Push within a stack ((auth), Settings) | `ios_from_right`, the iOS push on both platforms |
| Root guard changing group (onboarding → sign-in → app) | `fade` |
| Switching tabs | a 260 ms cross-fade with a 16 pt drift on the tokens' emphasized curve, which dissolves without the drift under Reduce Motion (ADR 044) |

## Alternatives

- **A carousel library** (react-native-pager-view and others): ruled out by the product. Most also
  need native code outside Expo Go.
- **Onboarding as the first `(auth)` screen:** returning users would pass through it. Product
  state belongs in the root guard, not in a screen.
- **Platform default transitions:** the app moved differently on iOS and Android.

## Consequences

- A device that cannot read Secure Store starts as a new device (onboarding, then sign-in).
- The test helper's in-memory Secure Store now undoes injected failures on `reset()`. Before, a
  failure injected in one test leaked into the next.
- Check swiping, the parallax, Reduce Motion and both themes on a device.
