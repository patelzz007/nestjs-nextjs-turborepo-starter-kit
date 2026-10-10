---
title: "ADR 043: Mobile Launch Screen and App Icon"
tags: ["adr", "mobile", "ui", "brand", "tokens"]
description: "The Expo app launches on a slate splash with the brand mark — native assets generated from the token source — and hands over seamlessly to an in-app launch screen that adds the app's name and a tagline."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 43
---

# ADR 043: Mobile Launch Screen and App Icon

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The app had no icon and no splash configuration. It launched on a white screen with the app's name
in a system font. The product wanted the brand mark on slate-800 with white text and a line of
wording. A native splash screen is only a colour and one image: it cannot render text, and the
repository has no image tooling.

## Decision

- **Two shared colour tokens**, `splash` (slate, brand 800) and `splash-foreground` (white). They
  are the same in every theme, so launching looks the same in light and dark.
- **Native assets generated from the token source.** `pnpm tokens:generate` renders, and copies to
  `apps/mobile/assets/`:
  - `app-icon.png`: 1024 px, the white mark on a full `splash` square. iOS and Android apply their
    own masks.
  - `splash-icon.png`: 1024 px, the mark alone on transparency.
  - `launch-colors.json`: the two colours as hex.

  The PNGs come from the generator's own rasterizer and deterministic DEFLATE
  (`generator/raster.ts`, `deflate.ts`, `png.ts`, ADR 040). They are about 40 KB, not 4 MB, and
  identical on every machine.
- **`app.config.ts` reads them.** `icon`, `android.adaptiveIcon`, and `expo-splash-screen` (the
  mark at 96 pt on `splash`, the same in dark mode). The colours come from the generated JSON,
  validated with zod, so the native splash and the in-app screen cannot drift apart.
- **An in-app launch screen continues it.** As soon as the typefaces load, the native splash hides
  and `LaunchScreen` (`src/components/launch-screen.tsx`) draws:
  - The same colour and the same white mark at the same size, dead centre. The hand-off is
    invisible.
  - Below it, the app's name (Bricolage) and a tagline that fade in. The tagline is
    `LAUNCH_TAGLINE` in `app-shell.tsx`, which products change.

  Since ADR 044 the mark animates: the faces settle, the mark lifts, and light travels around the
  cube while waiting. It stays until the session is restored, then fades out over the first screen (no fade with
  Reduce Motion). There is no artificial delay; it is shown exactly as long as start-up takes.

## Alternatives

- **Text baked into the splash image:** it needs a text renderer in the generator. It would also
  be pixels, not the brand typefaces, and would not follow the app's name (`MOBILE_APP_NAME`).
- **A minimum display time** so the wording is always read: it slows every launch to show a
  slogan.
- **Hand-made image assets:** they drift from the token source, as the favicons did.

## Consequences

- Expo Go draws its own loading screen while it downloads the JavaScript bundle. The native splash
  and the icon appear as configured in development and store builds, and the in-app launch screen
  appears everywhere, Expo Go included.
- Changing the mark or the `splash` colour means editing the token source and running
  `pnpm tokens:generate`. A store build is needed for new native assets, not an OTA update.
