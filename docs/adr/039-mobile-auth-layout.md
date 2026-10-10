---
title: "ADR 039: The Mobile Auth Layout"
tags: ["adr", "mobile", "ui", "auth"]
description: "Every signed-out mobile screen renders only its form inside one AuthShell — the web sign-in's dark brand panel above a rounded sheet — and every password field can show or hide what was typed."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 39
---

# ADR 039: The Mobile Auth Layout

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

Each `(auth)` screen (sign in, sign up, forgot password, two-factor, verify device, verify email,
forced 2FA enrollment) laid itself out with the generic `Screen`. They had no shared brand, and
their links were stacked as ghost buttons. The web apps' sign-in uses one `AuthLayout` with a dark
brand panel built from the `auth-*` tokens. The product wanted the same idea on mobile: one layout
around every auth screen, with each screen holding only its form, and an eye toggle on every
password field.

## Decision

- **`AuthShell` (`src/components/auth-shell.tsx`), rendered once by `src/app/(auth)/_layout.tsx`
  around the stack:**
  - **Brand area:** the dark auth panel (`bg-auth-panel`, the same in both themes), with the
    brand centred as on the web panel. It shows a large `auth-brand` tile with the web's mark
    (the brand mark, [ADR 040](./040-brand-mark.md)), the green status dot (pulsing like the web's), the app's name in Bricolage and a one-line tagline.
  - **Sheet:** a rounded `bg-card` sheet holds the screens. Because the brand area takes the
    top of the screen, the sheet is only as tall as a form needs.
  - **While typing:** with the keyboard open, the brand folds into a compact row so the form keeps
    its room.
- **`AuthPage` (`src/components/auth-page.tsx`), the only frame a screen uses:**
  - It shows the title (Bricolage), an optional description, the form and an optional footer
    pinned to the bottom ("Don't have an account? Create one").
  - Scrolling, keyboard avoidance and the bottom safe area are handled here once.
  - Screens contain nothing but their words and their form.
- **Links are links.** Navigation between auth screens uses `TextLink` (`accessibilityRole="link"`,
  with an optional lead-in sentence). "Forgot password?" sits under the password field. "Sign out"
  in a footer acts in place, so it is announced as a button.
- **Password visibility.** `TextField` gives every `secureTextEntry` field an eye button
  ("Show password" or "Hide password", named after the field). It starts masked each time the
  field mounts. This also covers the Security screen and the 2FA enrollment password. Fields show
  a `ring` border while focused.
- **No logging of the login response.** Sign-in printed the whole response (tokens included)
  behind an `eslint-disable`. Both are removed, and a test guards against it.

## Alternatives

- **Each screen draws its own header:** this is what we had. The brand drifts screen to screen,
  and every product built on the kit would copy the spacing.
- **A separate brand screen before sign-in:** one extra tap for no gain.

## Consequences

- A new signed-out screen is a route file in `src/app/(auth)` that returns an `AuthPage`. It never
  needs a `Screen`, a logo or its own keyboard handling.
- The brand name is the app's configured name (`appName`), and the mark is set in the `(auth)`
  layout. A product changes both in one place.
- Rounded-sheet clipping of the native stack, the compact switch with the keyboard, and both
  themes must be checked on a device.
