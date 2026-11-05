---
title: "Feature flags"
description: "Runtime feature flags: how a flag is declared, how staff turn it on, off or on for a share of people from Settings, per merchant or per branch for a store flag, and how the apps and the API evaluate it."
order: 7
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop"
tags: ["guide", "operations", "development"]
---

# Feature flags

Enhancement 5.6. A flag starts as a fact of the deployment (an env variable, or something the API reports) and
can then be changed at runtime from **Settings → Feature flags**, without a release.

| | |
|---|---|
| Declaring one | Add its key to `FeatureFlagKeySchema` and its title, description and "default comes from" to `FEATURE_FLAG_REGISTRY` (`@workspace/shared`); give its default in the app that evaluates it (`apps/admin/lib/feature-flags.ts`) |
| Settings | **Default** (the deployment decides, exactly as before), **On**, **Off**, or **On for a share of people** (1–99%). Every change needs a reason; the request audit and the change trail keep it |
| Evaluating | `evaluateFeatureFlag(key, setting, defaultOn, personId)`: the setting decides over the default. A percentage puts each person in a stable bucket (FNV-1a of the flag and the person), so the same person always gets the same answer and raising the share only adds people |
| In the admin | One answer per request (`loadEnabledFeatureFlags`) feeds the sidebar, the home page and the flagged routes, so a menu item and its page never disagree. The person comes from the API-verified session. If the settings can't be read, every flag stays on its default |
| Permissions | Any admin staff member reads the bare settings (to evaluate them); `FEATURE_FLAG:LIST` sees who changed what, `FEATURE_FLAG:UPDATE` changes one |
| Two kinds | A **platform** flag (`component-gallery`, `merchant-invites`) is one answer for the whole deployment. A **store** flag (`till-redemption`, `STORE_FEATURE_FLAG_DEFAULTS`) is asked where a store acts, and can also be set per merchant or per branch |

## Per store (enhancement 5.11)

"On for the KL branch, off for Melaka": a store flag's **Per store** section on the same page sets a merchant's or one
branch's own value, with a reason. The nearest setting wins:

| Order | Setting | Example |
|---|---|---|
| 1 | The branch's own | Bukit Katil: **Off** ("tills being replaced") |
| 2 | Its merchant's own (every branch) | Jonker Street Kitchen: **On** |
| 3 | The flag's setting (Default, On, Off, a share) | Default |
| 4 | The flag's default (`STORE_FEATURE_FLAG_DEFAULTS`) | `till-redemption`: on |

| | |
|---|---|
| Evaluating | `evaluateStoreFeatureFlag(key, { merchant, branch }, setting, subjectId)` = `branch ?? merchant ?? evaluateFeatureFlag(...)` (`@workspace/shared`) |
| In the API | A context that acts at a store asks through its own port; its adapter calls `STORE_FEATURE_FLAGS.isOnAtStore(key, { tenantId, locationId }, subjectId)` (exported by `contexts/feature-flags/public-api.ts`, read under the `feature_flags.evaluate` system operation) |
| The first one | `till-redemption`: pos's `TillRedemptionGate`. Off at a till's store, a code preview and a new sale answer `403 TILL_REDEMPTION_DISABLED`; a sale already made still replays with its idempotency key |
| Endpoints | `GET /admin/feature-flags/:key/overrides` (LIST), `GET /admin/feature-flags/stores?search=` (UPDATE, the store picker), `PUT /admin/feature-flags/:key/overrides` (UPDATE, replaces the store's earlier setting), `POST /admin/feature-flags/:key/overrides/:overrideId/remove` (UPDATE, with a reason; a POST so the reason can't be dropped). A branch that isn't the merchant's answers `404 FEATURE_FLAG_STORE_NOT_FOUND` |
| Storage | `FeatureFlagStoreOverride`: soft-deleted, never overwritten, so the trail keeps every earlier setting; one live row per flag and merchant (`locationId` null) and per flag and branch (partial unique indexes) |
| Adding a store flag | Add the key to `FeatureFlagKeySchema` and `StoreFeatureFlagKeySchema`, its entry to `FEATURE_FLAG_REGISTRY` (`scope: "store"`) and its default to `STORE_FEATURE_FLAG_DEFAULTS`; ask it through a port in the context that acts |
| Seeded | Jonker Street Kitchen on for every branch, Bukit Katil off, and an earlier Bukit Katil setting kept removed |
