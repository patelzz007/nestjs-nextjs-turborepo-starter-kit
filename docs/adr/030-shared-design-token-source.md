---
title: "ADR 030: One Platform-Neutral Design Token Source"
tags: ["adr", "ui", "design-tokens", "mobile"]
description: "Design tokens move out of hand-written CSS into packages/tokens, a TypeScript source with no platform dependencies that generates the web CSS variables and the mobile theme."
author: "Platform Team"
lastUpdated: 1791417600000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 30
---

# ADR 030: One Platform-Neutral Design Token Source

## Status

Accepted (2026-10-08). Implemented (2026-10-08): `packages/tokens`, consumed by `packages/ui` through
the generated `web.css` (see [the mobile plan, section 5](../technical/mobile/mobile-app.md#5-piece-1-packagestokens)).

## Context

Colors, radii and the other design tokens exist only as hand-written CSS variables in
`packages/ui/src/styles/palette.css` and `tokens.css` (Tailwind v4, oklch colors). The web apps
consume them through `packages/ui`. The Expo app cannot read those files, and React Native does
not understand every CSS color form. Two hand-maintained token sets would drift, and every product
built on this starter would inherit the drift.

## Decision

- Create `packages/tokens`: the single source of truth for design tokens, written in TypeScript,
  with no platform dependencies.
- It **generates** the web CSS variables that `packages/ui` consumes, replacing the hand-written
  values in `palette.css` and `tokens.css` (variable names stay the same, so components do not
  change), and the mobile app's Uniwind theme CSS in the same format (ADR 032).
- Generated output is never edited by hand. It is **committed**, produced by `pnpm tokens:generate`,
  and a test (run in CI) fails when the committed output is stale, the same discipline as
  generated migrations.
- Both platforms get the **same variable names and values**; only a thin wrapper differs (`:root` /
  `.dark` for web, Uniwind's `@layer theme` / `@variant` for mobile). The generator fails when any
  theme is missing a variable another theme defines.

## Alternatives

- **A separate token copy for mobile**: drifts.
- **Parse the web CSS to derive mobile tokens**: makes CSS the source of truth and couples mobile
  to web syntax.

## Consequences

- Changing a token is one edit, and both platforms follow.
- Web token ownership moves from `packages/ui` to `packages/tokens`.
- The generator and a check that the generated output is current become part of the toolchain.
