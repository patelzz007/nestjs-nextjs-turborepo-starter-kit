# Feature flags v2 — working build plan (2026-11-17)

Agreed in the grilling session (2026-11-13 → 2026-11-17). Terms: `GLOSSARY.md` → "Feature flags". ADR 086 (revisions).
Phases A–F are built in one go; the full gate runs once at the end. No subagents, no commits, no migrate/seed on the dev DB.

## Decisions (short)

| Area | Decision |
|---|---|
| Keys | Declared in code (`FeatureFlagKeySchema`, `DynamicConfigKeySchema`); each declares rollout unit, apps, default |
| Order | kill switch → flag override (user → location → tenant) → rules (first match; its percentage decides) → code default |
| Missing unit | A rule's percentage needs the flag's rollout unit; without it the rule doesn't match (falls through) |
| Evaluation | API only. Clients get a bundle of results (`GET /feature-flags/bundle`), never rules |
| Live | SSE `GET /feature-flags/stream` sends `{ version }` only; signed-in only; clients invalidate the bundle query |
| Anonymous | Device id: web first-party cookie set by the API; mobile UUID kept on the device |
| Storage | Revisions (ADR 086): unchangeable rule sets; kill switch + overrides audited outside revisions |
| Refusal | `FEATURE_UNAVAILABLE`, HTTP 403 |
| Permissions | FEATURE_FLAG LIST/UPDATE/APPROVE, FEATURE_FLAG_GROUP LIST/UPDATE, DYNAMIC_CONFIG LIST/UPDATE, EXPERIMENT LIST/UPDATE |
| Admin nav | New sidebar group "Releases": Feature flags, Dynamic configs, Experiments, Flag groups |
| 5.11 | `FeatureFlagStoreOverride` → `FeatureFlagOverride` (tenant / location); `ADMIN_SHOWCASE` default → seeded rule |
| Exposures | On check; client dedupe per session; batched POST (signed-out allowed for device-unit flags, strict limits) → outbox → Kafka `platform.feature-flags` → analytics-consumer → `FeatureFlagExposure`; daily rollup; raw 90 days |
| Schedules | Steps inside a rule; percentage from the clock; repeatable job bumps the version at step times; bundle carries `nextChangeAt` |
| Dynamic configs | Zod value schema in code; named values as JSON; rules pick a value name |
| Approvals | Production only; nobody approves own; 7-day expiry; kill switch/overrides exempt |
| Experiments | On a dynamic config; variants = value names with allocation; separate salt; metrics declared in code from platform events; daily job; 95% CI; no layers |
| Environments | `DEPLOYMENT_ENVIRONMENT`; rule promotion by export → diff → import (new revision; listed groups, overrides, kill switch not carried) |
| Mobile boilerplate | expo-boilerplate gets the same hook + gate on mock data, no API |
| Seed | Every new column; more tenants (3–5 branches each, ~50 rewards per branch), diamond customers claiming across ~5 shops |

## Progress

- [x] Shared contracts (tests pending)
- [x] Prisma schema + RLS + system operations + permissions (migration file pending: needs `db:migrate:create`)
- [x] API context A–F (src typechecks; unit tests + e2e pending)
- [x] Subject facts: identity (email domain), authorization (permissions, staff), tenancy (worksAt), tiers (tier)
- [x] Flags seed (every new table/column) + e2e rewrite (not yet run: needs migrated DB)
- [x] Migration `20261117210000_feature_flags_rules_and_experiments` (from `prisma migrate diff`; `migrate dev` refuses non-interactive drops), later folded into the regenerated init `20261117181407_init` with the baseline moved
- [x] Unit tests: API domain + services (53), messaging projections/stats/analytics, consumer projection
- [x] analytics-consumer: exposure + metric projection, hourly purge / daily sums / experiment results (`ExperimentMetricEvent` added: analytics rows keep no content)
- [ ] Admin console
- [ ] Merchant / web / mobile hooks + one flag each
- [ ] expo-boilerplate
- [ ] Seeds (flags + data expansion)
- [ ] Docs, ADRs, enhancements, gate
