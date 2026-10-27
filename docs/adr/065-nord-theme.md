---
title: "ADR 065: Nord as a third theme"
tags: ["adr", "design-tokens", "theming", "accessibility", "mobile", "docs"]
description: "Light, dark and Nord on every surface (web, admin, merchant, docs, mobile), from the one token source: Nord is its own dark theme class, the dark variant covers it, and every pairing is held to WCAG AA by the same contrast tests."
author: "Platform Team"
lastUpdated: 1793059200000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 65
---

# ADR 065: Nord as a third theme

## Status

Accepted (2026-10-27). Extends [ADR 030](./030-shared-design-token-source.md) (one token source) and
[ADR 032](./032-uniwind-for-mobile-styling.md) (Uniwind themes on mobile). Rules: `rules/07-ui-system.md` → "Themes".

## Context

People asked for the [Nord](https://www.nordtheme.com) palette as an option for dark mode in every
app and the docs, alongside the existing light and dark (cool ink) themes, not instead of them.
Nord is sixteen named colours: Polar Night (nord0–3) for surfaces, Snow Storm (nord4–6) for text,
Frost (nord7–10) for accents and Aurora (nord11–15) for status. Several Nord accents are not legible
as text on Nord's own surfaces: Aurora red `#bf616a` is 3.05:1 on nord0.

## Decision

1. **One more theme in the token source.** `ThemeNameSchema` gains `nord`. `NORD_THEME` defines
   every role (a missing role does not compile), on a new `nord` palette scale holding the sixteen
   colours exactly as published. The generator writes `.nord` for the web, `@variant nord` for
   mobile, and the palette for the docs.
2. **Nord is a dark theme, and its own class.** next-themes puts one class on `<html>` per theme,
   so Nord cannot also carry `.dark`. Instead:
   - the `dark:` variant matches `.dark` and `.nord`;
   - `color-scheme` is set in CSS (next-themes only writes it for `light` and `dark`);
   - code asks `isDarkTheme()` rather than comparing with `"dark"`;
   - light-only app overrides exclude `.nord`.
3. **Accents follow Nord, filled vivid.** Admin, docs and mobile use Frost blue, web Frost cyan, and
   merchant Aurora green, each with Polar Night text on it. Status colours and charts are Aurora.
   Nord's own pastels made buttons and the active nav pill read as disabled (reviewed 2026-10-27,
   "very boring"), so accent FILLS use the palette's `vivid` scale: nord8, nord9 and nord14 at the
   same hue with about 1.9× the OKLCH chroma and slightly more lightness (5.0–6.8:1 under Polar Night
   text). On the web, a primary button under Nord also casts a soft shadow in its own accent
   (`--primary-glow-mix`, 0% in light and dark). Surfaces, text and status colours stay exact Nord.
   The Expo app instead fills Nord's buttons, switches, focus and active tab with Snow Storm
   (nord6) and Polar Night text (10.8:1), at the owner's request: a near-white accent rather than
   blue. Its re-maps live in `packages/tokens/src/mobile-theme.ts` (`MOBILE_THEME_OVERRIDES`,
   brand roles only, applied to mobile.css alone), the mobile counterpart of the web apps'
   `app/<name>-theme.css`. Links there keep a colour of their own: the `link` role (link text and
   ghost-button labels; the accent in light and dark), which under Nord is Frost cyan nord8
   lightened to `#94c6d4` (AA on every Nord surface), so a link never looks like body text.
4. **AA is not negotiable.** Where a token is text, the Nord hue is lightened toward nord6 by the
   least amount that reaches 4.5:1 on its fill (tones, tiers, the docs' error callout, muted text).
   Fills, charts and status marks keep the published colours. The same contrast tests that hold
   light and dark now hold Nord: tokens, each app theme, and the docs.
5. **Mobile:**
   - Uniwind registers `nord` as an extra theme, and the Appearance setting offers it.
   - Because Uniwind leaves the OS colour scheme on "system" for a custom theme, the app pins it to
     dark under Nord, so the keyboard, alerts and status bar match.
   - The generated `mobile.css` declares `@custom-variant nord` itself. Uniwind compiles that file
     while discovering themes, before its own stylesheet knows the new one, so a first build would
     otherwise fail.
6. **Switching:**
   - The web shell's theme control becomes a menu (Light / Dark / Nord / System).
   - The `D` hotkey, the command palettes and the docs header button cycle light → dark → Nord.
   - Code blocks in the docs keep their own theme toggle; under Nord, "match the site" shows the
     dark code theme (One Dark Pro).

## Consequences

- A new theme costs one data object plus each app's accent block. The type system and the
  contrast tests list everything else that must change.
- Every `dark:` utility already written works under Nord without edits. A rule written as
  `:root:not(.dark)` is now a bug, and the app theme tests check for it.
- The docs' existing dark callouts keep two titles below 4.5:1 (info 4.05:1, error 3.71:1). That
  predates this decision and is tracked separately; Nord's callouts pass.
