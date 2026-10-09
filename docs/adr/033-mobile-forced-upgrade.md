---
title: "ADR 033: Minimum Supported Mobile App Version (Forced Upgrade)"
tags: ["adr", "mobile", "api", "versioning"]
description: "The mobile app sends its version on every request; the API rejects versions below a configured minimum with 426 Upgrade Required in the standard error envelope, and the app shows a blocking update screen."
author: "Platform Team"
lastUpdated: 1791417600000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 33
---

# ADR 033: Minimum Supported Mobile App Version (Forced Upgrade)

## Status

Accepted (2026-10-08). Implemented in piece 3 of the mobile plan (2026-10-08) — see [Mobile app §7](../technical/mobile/mobile-app.md#7-piece-3-the-mobile-client-type-in-the-api). The mobile app sends `X-App-Version` and shows its blocking update screen on any 426 since piece 5 (2026-10-09) — see [§9](../technical/mobile/mobile-app.md#9-piece-5-appsmobile).

## Context

Web apps are redeployed with the API; installed mobile apps are not. Users keep old builds for
months, so an API change can break a client the team can no longer update. The mechanism that tells
an old build to update must already be inside that old build: it cannot be added after the first
release.

## Decision

- The mobile app sends its version in an `X-App-Version` header on every request.
- The API reads a `MOBILE_MIN_SUPPORTED_VERSION` setting (validated by the config schema). A
  `mobile` client-type request whose version is missing or below the minimum is rejected with
  **426 Upgrade Required** in the standard error envelope (ADR 016).
- On 426 the app shows a blocking "please update" screen that no navigation can bypass.
- Browser client types are never checked: they always run the deployed version.

## Alternatives

- **No mechanism in the starter**: the first released build could never be forced to update.
- **A remote-config fetch at launch**: an extra request and endpoint, and it misses the case where
  an old build is already running when the minimum changes.

## Consequences

- Breaking API changes for mobile are shipped by raising the minimum after the new build is live
  in both stores.
- Raising the minimum locks out users who cannot update (old OS versions); the release checklist
  must consider that before raising it.
