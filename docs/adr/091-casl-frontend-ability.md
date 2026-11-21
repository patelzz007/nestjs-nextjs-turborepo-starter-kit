---
title: "ADR 091: CASL on the Frontend, as a Projection of the API's Decisions"
tags: ["adr", "authorization", "frontend", "casl"]
description: "Every app shows and hides UI through one CASL ability built from the session's capabilities, in the permission catalogue's own vocabulary; CASL never re-implements ownership, shares or store scope, and the backend stays AccessControlService plus row-level security."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1795132800000
editedAt: 1795132800000
coverImage: "/images/covers/adr/091-casl-frontend-ability.webp"
order: 91
---

# ADR 091: CASL on the Frontend, as a Projection of the API's Decisions

## Status

Accepted and built (2026-11-18); **amended by [ADR 092](./092-route-verbs-and-per-record-decisions.md)**: outside a
provider the ability denies everything instead of throwing, a capability refusal re-reads the session's capabilities,
the ability is built in each app's provider (`@workspace/shared` keeps only `abilityRules`), and rewards carry per-record
`viewerCapabilities`. Replaces the bespoke `<Can permission>`, `CapabilitiesProvider`, `useAuthorization()`
and `useCan()` in every app. The backend is unchanged: `AccessControlService` ([ADR 067](./067-unified-authorization-model.md))
and PostgreSQL row-level security ([ADR 090](./090-permission-level-tenant-rls.md)) decide every request.

## Decision

| Part | Decision |
|---|---|
| Library | `@casl/ability` 7.1.3 and `@casl/react` 7.1.0, used as shipped (`AbilityProvider`, `Can`, `useAbility`) |
| Vocabulary | The permission catalogue's own: action = catalogue verb, subject = catalogue noun (`<Can I="UPDATE" a="REWARD">`, `ability.can("DELETE", "PRODUCT")`). No second naming scheme |
| Rules | Built from the session's capability slugs (`GET /auth/permissions`, or the merchant membership's) by `defineSessionAbility` in `@workspace/shared`. **No conditions**: the browser never re-implements ownership, shares or store scope |
| Namespaces | Admin, web and mobile build from `platform:*` slugs; the merchant app from `merchant:*` (through the existing `MERCHANT_CAPABILITY_PERMISSION` map) |
| React | `SessionAbilityProvider` (builds the ability; a new capability list replaces it), typed re-exports of `Can` and `useAbility` in `@workspace/client`; the same on mobile |
| Menus | The navigation registry stays on capability slugs, independent of CASL; a slug held in a variable is checked with `abilityAllowsCapability` |
| Outside a provider | `@casl/react` throws; every app mounts the provider at its root, and an empty list (signed out, loading, failed) denies everything |

## Consequences

| Good | Cost |
|---|---|
| One standard API, typed against the catalogue: a misspelt verb or noun fails to compile | A component rendered outside a provider throws instead of quietly denying |
| No authorization logic in the browser to drift from the API | A record-specific decision (a share, an owner) needs the API to say so per record: planned as per-row `capabilities` on rewards (follow-up) |
| | **About 6 KiB (gzip) on every page whose shell mounts the provider**, measured 2026-11-20: 3.0 KiB is `Ability` and `@casl/react`, 3.2 KiB is `@ucast/*`, CASL's MongoDB-style condition engine. Our rules never carry conditions, so the engine is unused, but `@casl/ability`'s one entry file imports it at the top level and no bundler can drop it. The owner chose to keep CASL and pay this (2026-11-20). The merchant routes it pushed within 1% of their budget were re-budgeted to measured × 1.1 in `budgets/bundle.json`. Replacing CASL with an in-house set of `ACTION:RESOURCE` pairs, with the same `can()`, `<Can>` and `useAbility()` API, would win it back. |
