---
title: "ADR 087: Feature Flags v2"
tags: ["adr", "feature-flags", "experiments", "architecture"]
description: "The API evaluates feature flags and dynamic configs from rules set at runtime and hands each app a bundle of answers; rules never leave the server. Kill switch, overrides, rules, code default — in that order."
author: "Platform Team"
category: "Architecture decisions"
date: 1794873600000
lastUpdated: 1794873600000
editedAt: 1794873600000
coverImage: "/images/covers/adr/087-feature-flags-v2.webp"
order: 87
---

# ADR 087: Feature Flags v2

## Status

Accepted (2026-11-17). Supersedes the runtime settings of enhancement 5.6 (On / Off / a share) and the per-store
settings of 5.11, which become flag overrides. Flag revisions are ADR 086.

Terms (**feature flag**, **rule**, **condition**, **flag group**, **flag override**, **kill switch**, **exposure**,
**rollout unit**, **dynamic config**, **experiment**, **variant**, **scheduled rollout**, **environment**,
**rule promotion**) are defined in `GLOSSARY.md`.

## Decision

| Question | Decision |
|---|---|
| Where keys live | In code: `FEATURE_FLAG_REGISTRY` and `DYNAMIC_CONFIG_REGISTRY` (`@workspace/shared`) declare each key, its rollout unit, the apps that read it and its default. Rules are data, set at runtime |
| Who evaluates | The API only. Each app asks `GET /feature-flags/bundle?app=` and gets answers (on/off, a config value, which revision and rule decided). Rules, groups and other people's data never leave the server |
| Order | Kill switch → flag override (person, then branch, then merchant) → the live revision's rules, first match wins → the code default |
| Rollout | A rule lets in a share of its matching subjects, by a stable FNV-1a bucket of the flag and the rollout unit's id (person, merchant, branch or device). A scheduled rollout's share is worked out from the clock; a maintenance job bumps the catalogue version when a step starts so clients refetch |
| Freshness | The catalogue is cached per process (ADR 072 AppCache) and invalidated by a Redis signal on every change. Signed-in clients hold an SSE stream that only announces the new version; they refetch the bundle |
| Signed out | A device id (a first-party cookie set by each web app's proxy; Secure Store on mobile) is sent as `X-Device-Id`. Person-unit flags fall to their default without a person |
| Server gating | `@RequireFeatureFlag(key)` on a controller answers `403 FEATURE_UNAVAILABLE` when off for the caller's verified tenant; contexts ask `FEATURE_FLAGS.isOn` through their own ports |
| Exposures | A client batches what it rendered (deduplicated per session) to `POST /feature-flags/exposures`; the API attributes and publishes them through the outbox to Kafka; analytics-consumer stores raw rows for 90 days and daily sums for good |
| Experiments | Run on dynamic configs: a share of the config's audience is split between variants; results per declared metric (from existing events) with a 95% Welch interval, worked out hourly |
| Changes | Every change has a reason and is audited. In production a rule change waits for a second person (`APPROVE`, never the author, 7-day expiry); the kill switch and overrides never wait |
| Environments | Each deployment owns its rules (`DEPLOYMENT_ENVIRONMENT`). Rules move by export → diff → import (rule promotion); listed groups, overrides and kill switches stay where they are |
| Management | Platform staff only, from the admin's **Releases** section (separate view and edit pages, and "Check a subject" to trace one decision) |

## Why

Statsig-style release control without shipping rules to clients: the server already knows who someone is, which
merchant and branch they work at, their tier and permissions, so it can evaluate conditions no client could be trusted
with — and a bundle of answers is small, cacheable and safe to hand out.

## Considered options

- **Client-side evaluation (ship rules to apps).** Rejected: leaks targeting (emails, ids, groups), and every client
  would need the facts the server already has.
- **A third-party flag service.** Rejected for the starter kit: products built on it decide that themselves; the
  ports (`FeatureFlags`, `SubjectFactSource`) keep a later swap local.
- **Polling only.** Rejected: an emergency kill switch should reach open screens in seconds, so signed-in clients
  stream the version.

## Consequences

- One migration replaces `FeatureFlagSetting` / `FeatureFlagStoreOverride` with revisions, overrides, kill switches,
  groups, exposures, experiments and their RLS policies; the seed writes every table.
- Contexts that supply facts (identity, tenancy, authorization, tiers) register a `SubjectFactSource`, so feature
  flags depend on none of them (no module cycle).
- A product adds a flag in code (registry entry and its use), then sets its rules in Releases — no deploy to change
  who gets it.
