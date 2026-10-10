---
title: "ADR 037: The Web's Typefaces on Mobile"
tags: ["adr", "mobile", "ui", "typography"]
description: "The Expo app uses the same typefaces as the web apps (Geist, Bricolage Grotesque, Geist Mono), loaded from Expo's Google Fonts packages as one family per weight."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 37
---

# ADR 037: The Web's Typefaces on Mobile

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The web, merchant, admin and docs apps use Geist for the UI and running text, Bricolage
Grotesque for headings and Geist Mono for codes. They load these as variable `.woff2` files from
`@fontsource-variable` (`packages/ui/src/fonts`). The mobile app used the device's system font.
React Native cannot load `.woff2`. It selects a custom font by **family name**, not by weight:
`fontWeight: 600` on a font that has only one weight loaded fakes the weight or falls back to the
system font. The app must keep running in Expo Go.

## Decision

- **Same typefaces, from Expo's Google Fonts packages:** `@expo-google-fonts/geist`,
  `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/geist-mono` (static `.ttf`).
  They are loaded at runtime with `expo-font` (`useFonts`), which works in Expo Go.
- **One family per weight.** `src/lib/fonts.ts` (`APP_FONTS`) registers exactly the weights the app
  uses: Geist 400, 500, 600 and 700, Bricolage Grotesque 600 and Geist Mono 400. Each weight is
  imported by path (`@expo-google-fonts/geist/600SemiBold`), so only those files are bundled.
- **Font utilities, not weight utilities.** `global.css` maps each family to a utility:
  `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-heading` and
  `font-mono`. Each value is one unquoted family name, because Uniwind passes it straight to
  `fontFamily`. Mobile code never uses `font-medium` / `font-semibold` / `font-bold`.
- **Every text sets its family.** React Native has no inherited default font. The text roles in
  `src/components/text.tsx` (`Heading` and `Subheading` use `font-heading`, the others use Geist,
  and the new `CodeText` uses Geist Mono) and every raw `<Text>` / `<TextInput>` carry a font
  utility.
- **The splash screen waits for the fonts.** The root layout loads them while the app runtime
  starts. `AppShell` (and the configuration-error screen) keep the splash screen up until both are
  ready. If loading fails, the app opens with the system font instead of hanging.

## Alternatives

- **Generate the mobile font utilities from `packages/tokens`:** the web's font tokens are CSS
  variables that Next.js and Astro fill in. On mobile, the value is the name a file was registered
  under at runtime, which only the app knows. So the names live in `apps/mobile`, next to the files
  they register.
- **Embed the fonts with the `expo-font` config plugin:** faster first paint in a real build, but
  it does not apply in Expo Go. A product that leaves Expo Go can add the plugin with the same
  family names.
- **Keep the system font:** the phone would look like a different product from the web.

## Consequences

- `APP_FONTS` and the `@theme` block in `global.css` must list the same names. A name that exists
  only in CSS renders in the system font, and nothing fails. Check new typography on a device.
- Adding a weight means: import it in `APP_FONTS`, add a utility in `global.css`, and use the
  utility.
- No lint rule bans weight utilities on mobile yet. Adding one means extending the shared
  `no-restricted-syntax` list in `packages/eslint-config/react-native.js`.
