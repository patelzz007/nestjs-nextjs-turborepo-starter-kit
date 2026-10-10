---
title: "ADR 040: One Brand Mark, from the Token Source"
tags: ["adr", "ui", "brand", "tokens", "mobile"]
description: "Every app shows one geometric brand mark — a faceted isometric cube in one colour — defined once in packages/tokens and drawn from that data on the web, the docs, the favicons and the phone."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 40
---

# ADR 040: One Brand Mark, from the Token Source

## Status

Accepted (2026-10-09). Implemented (2026-10-09).

## Context

The apps had no single mark:

- The web, merchant and admin favicons were a teal gift box, and the docs favicon was a "W" in a
  circle.
- The sign-in panels showed a different icon on each page (gift, lock, envelope, shield).
- The sidebars used a gift icon or the app's initials, and the phone used a Lucide gift.

The product wanted one clean, geometric, monochrome mark in the spirit of developer-tool marks such
as Cursor's. It had to be our own mark, not a copy: every product built from this starter kit
inherits it.

## Decision

- **The mark:** an isometric cube cut into three faces with a hairline gap between them. It is
  drawn in one colour at three strengths: the top face at full strength, the left face mid, the
  right face in shadow. It reads at 16 px and takes any single colour.
- **One source:** `packages/tokens/src/brand.ts` (`BRAND_MARK_FACETS`, `BRAND_MARK_VIEW_BOX`). The
  token package is already the shared design source of web and mobile.
- **Drawn from the data, never redrawn:**
  - **Web:** `BrandMark` in `packages/ui` draws `<svg>` paths in `currentColor`. `AuthLayout` now
    draws it itself, so it no longer takes a `logo` prop and the per-page icons are gone. It also
    replaces the icons in the web, merchant and admin sidebar headers.
  - **Mobile:** `BrandMark` (`react-native-svg`, coloured with `colorClassName`) in the
    `AuthShell`.
- **Favicons are generated, in every format browsers need.** `pnpm tokens:generate` renders the
  Expo app's sign-in tile exactly: the mark in `auth-panel-foreground`, at half the tile's size, on
  an `auth-brand-from` square with the same corner proportion. The phone's tile is the reference.
  Each app's tile takes the colour of its own sign-in tile (`--auth-brand-from`), so the apps are
  told apart in a row of tabs: slate (the shared default) for admin and docs, blue for web, green
  for merchant (`FAVICON_VARIANTS`). For each tone it writes three files:
  - `favicon.svg`: what Chrome, Edge and Firefox show.
  - `favicon.ico`: 16 and 32 px. Safari does not use SVG favicons and otherwise draws a letter of
    the site name (the "R" seen after the first version of this ADR shipped SVG only).
  - `apple-touch-icon.png`: 180 px, square, because iOS applies its own mask.

  Details:
  - The PNGs come from a small built-in rasterizer and PNG/ICO writer (`generator/raster.ts`,
    `png.ts`, `ico.ts`), with no image library.
  - The PNGs are compressed by a small deterministic DEFLATE (`generator/deflate.ts`, fixed
    Huffman codes, matches one pixel back and one row up), not Node's zlib, whose output can vary
    by Node version and CPU. So the bytes are identical on every machine and the staleness test
    can compare them, and the icons stay small (the 180 px icon is under 3 KB).
  - Colours are `#rrggbb`.
  - The same command copies the icons into Next's file conventions
    (`apps/{web,merchant,admin}/app/icon.svg`, `favicon.ico`, `apple-icon.png`; the layouts no
    longer set `metadata.icons`, so Next emits all three `<link>` tags with cache-busting hashes)
    and into `apps/docs/public/`.
  - A test in each app fails while a copy differs from the generated file.
- **The status dot pulses the same everywhere.** The web panel's dot uses Tailwind's
  `animate-pulse` (2 s, down to 50% opacity, `cubic-bezier(0.4, 0, 0.6, 1)`, `motion-safe`). The
  phone's `PulseDot` runs the same curve with Reanimated (`PULSE` in `src/lib/motion.ts`), and
  stays still while Reduce Motion is on (`useReduceMotion`).

## Alternatives

- **Copy Cursor's mark:** rejected. It is another company's trademark.
- **Hand-maintained SVG files per app:** this is how they drifted apart. One source plus a staleness
  test keeps them identical.
- **Per-page icons on the sign-in panel:** the panel is for identity. The page title already says
  what the page is for.

## Consequences

- Changing the mark means editing `brand.ts` and running `pnpm tokens:generate`. Every surface
  follows, and the tests catch a forgotten copy.
- `AuthLayout` callers no longer pass a logo. A product that needs its own mark replaces
  `brand.ts`, not the layout.
