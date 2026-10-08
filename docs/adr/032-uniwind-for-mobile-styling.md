---
title: "ADR 032: Uniwind (Free) for Mobile Styling"
tags: ["adr", "mobile", "ui", "styling"]
description: "The Expo app styles with Uniwind's free tier on Tailwind v4 instead of NativeWind, so web and mobile share one Tailwind major version and one token CSS format, and the app still runs in Expo Go."
author: "Platform Team"
lastUpdated: 1791417600000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 32
---

# ADR 032: Uniwind (Free) for Mobile Styling

## Status

Accepted (2026-10-08). Not implemented yet. Supersedes the NativeWind mandate in
`rules/04-mobile-expo.md`, which is updated when the mobile app lands.

## Context

The web apps use Tailwind v4 with oklch CSS variables. Stable NativeWind (v4) requires Tailwind v3;
the NativeWind version for Tailwind v4 is in preview. The mobile app must run in Expo Go, so it can
use no custom native code. Design tokens come from one source (ADR 030).

## Decision

- Style the mobile app with **Uniwind's free (MIT) tier** on **Tailwind v4**.
- Uniwind Pro is not used: it ships native code (Nitro modules, Reanimated 4) that Expo Go cannot
  load.
- Mobile themes are CSS variables under Uniwind's `@layer theme` / `@variant` theming, generated
  from `packages/tokens` in the same CSS format (oklch included) as the web output.

## Alternatives

- **NativeWind v4 + Tailwind v3**: a second Tailwind major version in the repo and a second token
  CSS dialect.
- **NativeWind v5 (Tailwind v4)**: preview software in a starter kit.
- **Uniwind Pro**: needs a custom dev build, so no Expo Go.

## Consequences

- One Tailwind major version and one token CSS format across web and mobile.
- Every theme must define the same variables (Uniwind warns otherwise); the token generator
  guarantees it.
- Moving to Uniwind Pro later means leaving Expo Go for development builds.
