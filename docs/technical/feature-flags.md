---
title: "Feature flags"
description: "Feature flags and dynamic configs (v2): keys in code, rules at runtime, evaluated by the API and handed to each app as a bundle; kill switch, overrides, groups, scheduled rollouts, exposures, experiments, approvals and rule promotion."
order: 7
author: "Platform Team"
category: "Engineering"
date: 1793664000000
lastUpdated: 1794873600000
editedAt: 1794873600000
coverImage: "/images/covers/technical/feature-flags.webp"
tags: ["guide", "operations", "development"]
---

# Feature flags

Feature flags v2 (ADR 087, revisions ADR 086). Keys are declared in code; who gets what is set at runtime from the
admin's **Releases** section. The API evaluates; every app receives answers, never rules.

## Adding one

| Step | Where |
|---|---|
| Declare the key, title, description, rollout unit (`USER`, `TENANT`, `LOCATION`, `DEVICE`), the apps that read it and its default | `FEATURE_FLAG_REGISTRY` (`packages/shared/src/contexts/feature-flags/schemas/registry.ts`) |
| A dynamic config instead: its value schema and default | `DYNAMIC_CONFIG_REGISTRY` (`schemas/dynamic-configs.ts`) |
| Read it in a web app | `useFeatureFlag(key)`, `<FeatureFlagGate flag>`, `useDynamicConfig(key)` (`@workspace/client/lib/contexts/feature-flags`); server components: the app's `lib/server/feature-flag-bundle.ts` |
| Read it in the mobile app | the same hooks from `src/contexts/feature-flags` |
| Gate an API route | `@RequireFeatureFlag(key)` (403 `FEATURE_UNAVAILABLE`), or `FEATURE_FLAGS.isOn(key, subject)` behind the context's own port |
| Hide a menu item | `featureFlag` on its sidebar JSON item (admin, merchant), its route rule (web), or its tab (mobile) |

## How a decision is made

| Order | Step | Notes |
|---|---|---|
| 1 | Kill switch | Off for everyone, at once; never waits for approval |
| 2 | Flag override | A person, then a branch, then a merchant (replaces the 5.11 per-store settings) |
| 3 | The live revision's rules | First matching rule wins; its share comes from a stable bucket of the flag and the rollout unit's id |
| 4 | The code default | Also the answer whenever the API can't be read |

Conditions: user id, email domain, platform staff, permission, merchant, branch, customer tier, app, platform, app
version, language, flag group, time window, environment. A `deploymentWide` flag (`customer-tiers`) ignores the subject.

## Freshness and devices

| | |
|---|---|
| Server cache | The catalogue (revisions, groups, overrides, kill switches, running experiments) is cached per process and invalidated by a Redis signal on every change |
| Clients | Bundle refetched on focus, every 5 minutes, at a scheduled rollout's next step, and on every frame of `GET /feature-flags/stream` (signed in; the frame carries only the version) |
| First paint | Admin, merchant and web render with the bundle the server loaded, so nothing flickers |
| Device id | Web: the `flagDeviceId` cookie each app's proxy sets, sent as `X-Device-Id`. Mobile: kept in Secure Store, sent on every request with `X-Client-Platform` |
| Offline (mobile) | The last bundle is kept in Secure Store and used until the API answers |
| Rate limits | The bundle and the stream are page-load reads, so they skip the per-IP `strict` throttler meant for credential routes (a Next server renders for every visitor from one address). The per-principal `default` throttler and the per-IP `preAuth` bucket still count them. Exposures have their own policy |

## Exposures and experiments

| | |
|---|---|
| Exposure | What a screen rendered: batched per session (`POST /feature-flags/exposures`, 30/min per IP), attributed by the API, published through the outbox (`platform.feature-flags`), stored by analytics-consumer: raw rows 90 days, daily sums kept |
| Experiment | On a dynamic config: a share of its audience split between variants (shares total 100%), a control, a primary metric and guardrails declared in code (`EXPERIMENT_METRIC_REGISTRY`). Results hourly, with a 95% Welch interval |

## Changing rules

| | |
|---|---|
| Permissions | `FEATURE_FLAG` LIST / UPDATE / APPROVE, `FEATURE_FLAG_GROUP` LIST / UPDATE, `DYNAMIC_CONFIG` LIST / UPDATE / APPROVE, `EXPERIMENT` LIST / UPDATE (Admin role; platform staff only) |
| Revisions | Every save is a new revision with a reason (ADR 086). In production (`DEPLOYMENT_ENVIRONMENT=production`) it waits for a second person's approval, expiring after 7 days |
| Flag groups | Conditions, or a listed group of up to 10,000 people, merchants, branches or devices; a person's memberships go with their account (erasure) |
| Rule promotion | Export a live revision from one environment, import it into another: the import shows the difference first; listed groups, overrides and kill switches stay where they are |
| Ready to remove | A flag that has given everyone the same answer for 30 days is badged in the list |

## Flags shipped with the kit

| Key | Unit | Apps | What it gates |
|---|---|---|---|
| `showcase` | Person | admin | The Components section |
| `merchant-invites` | Person | admin | Merchant invites (also needs a multi-tenant deployment) |
| `till-redemption` | Branch | api | Till redemptions at a store (`403` while off) |
| `customer-tiers` | Deployment | api, admin | Customer tiers (ADR 085) |
| `merchant-analytics` | Merchant | merchant, api | The merchant Analytics page and `/tenants/:slug/analytics` |
| `web-activity` | Person | web | The customer Activity page |
| `mobile-analytics` | Person | mobile | The Analytics tab |
| `reward-claim-cta` (config) | Person | web | How bold the reward Claim button is (the seeded experiment) |
