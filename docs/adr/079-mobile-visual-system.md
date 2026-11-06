---
title: "ADR 079: The Mobile App's Own Visual System"
tags: ["adr", "mobile", "ui", "design-tokens", "typography"]
description: "The Expo app stops borrowing the web's surfaces and becomes a generic, neutral account app: its own token layer re-maps any themed role per theme, pinned component colours keep the floating tab bar's light look, Geist sets the text and Bricolage Grotesque the button labels, and screens drop the sheet and the boxes-in-boxes for grouped lists on the page."
author: "Platform Team"
lastUpdated: 1793836800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 79
---

# ADR 079: The Mobile App's Own Visual System

## Status

Accepted (2026-11-05). The owner rated the mobile UI 3/10 (generic, weak hierarchy and type, cramped
layout, flat colours) and chose the **category standard, executed to a high craft bar** over every themed
direction: "generic enough for anyone to use", with Linear / Things precision and Airbnb / Notion
roominess, and a neutral ink accent. Amends [ADR 037](./037-mobile-typefaces.md) (typefaces), and the
token source of [ADR 030](./030-shared-design-token-source.md) and [ADR 065](./065-nord-theme.md), where the mobile app
could re-map brand roles only and Nord's mobile accent was Snow Storm. The bottom tab bar stays as it shipped in light; dark and Nord follow their surfaces (owner, same day).

## Context

The app reused the web's surfaces, borders and text, re-mapping only brand roles. On a phone that gave:

| Problem | Cause |
|---|---|
| Boxes inside boxes | A curved `bg-sheet` under the header, then a bordered card around every block, then bordered tiles inside cards |
| No type scale | 20pt centred titles; card titles, labels and body within a step of each other; one face for figures and labels |
| Muddy colour | Dark mode one blue-grey family, card and page a hair apart; amber status fills on screen all day |
| Flat lists | Settings rows with no icons, no group names, every group identical |

## Decision

1. **A mobile token layer** (`packages/tokens/src/mobile-theme.ts`). `MobileThemeOverridesSchema` lets the
   Expo app re-map **any** themed role per theme, unlike a web app (`AppThemeOverridesSchema`, brand
   roles only). The web never sees these values, except the admin panel's dark theme (item 6). A pure, zero-chroma `gray` scale carries light and a faintly cool `graphite` scale carries
   dark:

   | Theme | Page | Surfaces | Raised | Hairlines | Ink | Secondary text | Accent |
   |---|---|---|---|---|---|---|---|
   | Light | #e7f3fb (sky) | #f2f9fd (never pure white) | #f2f9fd | #e5e5e5, neutral grey (field and outlined-button edges #c7c7c7; checkbox and radio rings #8c8c8c, their own `control-ring` colour: outlines carry no blue, owner, 2026-11-06) | #1e293b (slate-800) | #3f6285 | slate-800 buttons, selection, tab capsule and sign-in panel; #2563eb links/focus. Chosen 2026-11-06 on the owner's phone, whose screen showed the first pick (#eff6ff) as cold and slightly violet: a sky blue with less violet, judged there rather than on a monitor. In light the drawer's sheet is the page's colour |
   | Dark | #1c1d20 | #292b2f | #313337 | #3a3c40 | #f0f1f4 | #a9adb6 | near-white ink; soft blue links/focus #8ab4ff (the `graphite` scale: neutral greys leaning faintly cool, chosen 2026-11-05 from five candidates) |
   | Nord | #2b2d36 | #303540 | #343a47 | #3b4150 | #e6e9f0 | #b8bfcb | white buttons and active items; steel-blue links #8aa4c8 (the `dusk` scale: the owner's editor-slate reference, parked under Nord when dark went back to the greys; text sharpened to read at a glance, every pair AA) |

   Three more dark themes are the phone's alone (2026-11-06): Current Dark (the pure greys, #1d1d1d page),
   Harbour (blue slate, #1a2030 page, cornflower #9bbcff accent: its buttons are that blue, not white) and Mocha
   (warm coffee greys, #201d1b page). They are `MobileOnlyThemeNameSchema`, written to mobile.css only, each a
   `DarkPalette` over the dark theme, so the web's theme menus never list them. Each sets its own `auth-panel`,
   so the sign-in screen and the ink drawers take the theme's colour instead of the shared navy.

   Status tints are calmed on mobile (light yellow at half chroma; dark fills one step above the card, low
   chroma; a warm amber instead of near-neon yellow text).
2. **Pinned component colours** (`MobileComponentColorsSchema`, `--tab-bar*`, `bg-tab-bar`). The floating
   tab bar reads its own five colours, so a change to the shared roles can never move it by accident.
   Light keeps exactly the values it shipped with; dark and Nord match their surfaces.
3. **Type.** Geist for all text (`font-heading` = Geist SemiBold; large titles Geist Bold, tight), Geist
   Mono for code, and Bricolage Grotesque SemiBold for button labels only (`font-button`, owner's call,
   2026-11-05): nowhere else on the phone.
4. **Layout.** Content sits straight on the page (`Screen` draws no sheet), sections `gap-6`. Page titles
   are 24pt bold and left-aligned in the header row, the subtitle under them. Grouped lists use the new
   kit `ListGroup` (one rounded surface, inset hairlines, a title above, a note below); `ListRow`s carry
   the drawer's icons. Figures are bold and tabular; KPI and highlight grids are one surface split by
   hairlines; `StatTiles` default to `plain` figures. Inputs take the page colour (a recessed well inside
   a card). The page header carries no status pills (owner, 2026-11-05): connection and session live in
   the drawer, in their tinted tones (retuned in dark and Nord so they read as colour, every pair AA).
5. **Original language logos.** GitHub's languages show their brands' own full-colour logos (devicon,
   bundled as SVG and checked byte for byte against the pinned package by a tooling test), on a light
   `logo-tile` chip in every theme; a language devicon has no original for keeps its Simple Icons glyph.
6. **The drawer** (revised 2026-11-06) comes in five looks the person chooses in Settings → Appearance, saved
   as the `drawerStyle` preference; `centred-ink` is the default. Each look is one row in
   `features/navigation/drawer-layouts.ts`, a combination of the same parts: an ink surface (the sign-in panel's
   `auth-panel`) or a soft wash; the person in a row, stacked or centred; the status as a line or two cards; a
   rounded sheet or none; a solid or soft selected capsule (soft is grey in the dark themes and slate in light, owner, 2026-11-06). Rows are a bare glyph and label: the tinted tiles and
   the section cards are gone. Every solid button is the same (`primary` and `secondary` alike): pure white in
   the dark themes, Tailwind's slate-800 (`#1e293b`) in light. Destructive buttons stay red, and text links stay
   text.

7. **Connection test timing.** The first ping test ran at mount, inside the app's startup work, and
   React Native times a round trip on the JS thread, so that work read as latency (the ping looked bad
   after every reload until a manual re-test). `NetworkQualityMonitor` takes a `scheduleTest`; the mobile
   app runs automatic tests when the JS thread is idle (`requestIdleCallback`, 5 s deadline). A test the
   person asks for still runs at once; the web apps keep the default (at once).

8. **Signed-out screens keep ADR 039's design** (owner, 2026-11-05). The redesign had moved sign-in,
   sign-up and the other signed-out screens onto the plain page; the owner preferred the original: the
   dark auth panel with its quiet outlines and status dot, the web sign-in's panel, under a rounded sheet.
   Reverted in both repos, and the mobile `auth-*` re-maps were removed so the panel takes the shared
   (web) values again in every theme.

6. **The admin panel's dark theme is graphite too** (owner's call, 2026-11-05, after side-by-side screenshots of every
   admin area). The dark row above is one object, `GRAPHITE_DARK_THEME` (`mobile-theme.ts`); the admin reads the same
   object through `ADMIN_THEME_OVERRIDES` (`admin-theme.ts`, `AdminThemeOverridesSchema`: any themed role), and the
   generator writes it into `web.css` under `.dark .admin-app` (the admin's body class). The admin's light and Nord
   themes, and the web app's and merchant portal's dark themes, stay the shared ones. The contrast test checks the
   admin's dark theme as its own theme (`.dark .admin-app` over `.dark`).

## Consequences

- Mobile and web no longer share surface values; a web surface change does not reach the phone. The
  generator tests guard both directions (mobile re-maps, web untouched, tab bar pinned).
- The same system is ported to `expo-boilerplate` (same files, names and tests; only import paths,
  formatting and the boilerplate's own feature differences vary).
- A change to the graphite dark theme moves the phone and the admin panel together (one object); a product that
  wants them apart gives `ADMIN_THEME_OVERRIDES` its own values. The phone already overrides four roles on top of
  it (`primary` and the `sidebar` selection roles, pure white, 2026-11-06); the admin panel keeps `#f0f1f4`.
- A product rebranding the kit edits `mobile-theme.ts` (and the tab bar's colours, explicitly), nothing else.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the web's surfaces, polish spacing | Leaves the muddy dark and the sheet; the owner wanted the whole world replaced |
| Themed directions (night-market stalls, stored-value card, transit diagram, ticket wallet) | Presented on the decision page; the owner preferred a generic system any product can adopt |
| Let the tab bar follow the shared roles | It would have changed on every surface edit; the owner wanted it fixed unless changed on purpose |
