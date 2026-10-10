---
title: "Architecture decision records"
description: "One line per decision with its status. ADRs are history: superseded ones stay, marked and linked forward."
order: 1
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
tags: ["adr", "architecture", "decisions"]
---

# Architecture decision records

Each record states the context, the decision, the alternatives and the consequences
([`rules/14-documentation.md`](../../rules/14-documentation.md#adr-architecture-decision-record)).
Never delete an accepted ADR: mark it superseded and link the replacement.

| ADR | Decision | Status |
| --- | --- | --- |
| [001](./001-permission-first-rbac.md) | Permission-first RBAC | Accepted |
| [002](./002-explicit-junction-tables.md) | Explicit junction tables for RBAC relations | Accepted |
| [003](./003-jwt-identity-only.md) | JWTs carry identity only | Accepted |
| [004](./004-authorization-caching.md) | Authorization caching (memory + Redis invalidation) | Accepted |
| [005](./005-telescope-in-memory-store.md) | Telescope in-memory store | **Superseded** — the Telescope module was removed; observability is described in [Observability](../technical/operations/observability.md) |
| [006](./006-module-health-indicators.md) | Module-level health indicators | Accepted |
| [007](./007-tenancy-and-rls-bypass.md) | Tenancy mode and RLS bypass | Accepted |
| [008](./008-canonical-organization-tenant.md) | Organization is the canonical tenant | Accepted |
| [009](./009-url-tenant-resolution.md) | Tenant resolved from the URL slug | Accepted |
| [010](./010-rls-transaction-contract.md) | Transaction-local RLS contract | Accepted |
| [011](./011-cedar-precedence.md) | Cedar ABAC precedence and policy governance | Accepted |
| [012](./012-system-operations.md) | Allow-listed system operations | Accepted |
| [013](./013-organization-location-ownership.md) | Organization and location ownership | Accepted |
| [014](./014-org-scoped-rewardhub.md) | Org-scoped RewardHub | Accepted |
| [015](./015-transactional-outbox-and-inbox.md) | Transactional outbox and consumer inbox | Accepted |
| [016](./016-standard-error-envelope.md) | Standard error envelope and global exception filter | Accepted |
| [017](./017-unified-request-context.md) | One typed request context and a separate RLS store | Accepted |
| [018](./018-strict-typescript-and-as-const-ban.md) | Strict TypeScript flags and the `as const` ban | Accepted |
| [019](./019-tanstack-form-standard.md) | TanStack Form is the form standard | Accepted — migration incomplete |
| [020](./020-payments-provider-port.md) | Payments as a provider-neutral port | Accepted — not implemented yet |
| [021](./021-list-query-grammar.md) | One list-query grammar | Accepted |
| [022](./022-response-contracts.md) | Response contracts for every endpoint | Accepted |
| [023](./023-client-state-feature-stores.md) | Client state as Zustand feature stores | Accepted |
| [024](./024-confluent-kafka-client.md) | Confluent Kafka client instead of kafkajs | Accepted |
| [025](./025-global-http-audit-log.md) | One global, append-only HTTP audit log — kept forever | Accepted |
| [026](./026-kernel-first-authorization.md) | One in-house authorization kernel behind one global guard | Accepted |
| [027](./027-fastify-http-adapter.md) | Fastify as the API's HTTP adapter | Accepted |
| [028](./028-epoch-millisecond-timestamps.md) | Epoch-millisecond timestamps everywhere | Accepted |
| [029](./029-mobile-client-body-token-transport.md) | Mobile is a client type with body-delivered tokens | Accepted — implemented (API 2026-10-08, mobile app 2026-10-09) |
| [030](./030-shared-design-token-source.md) | One platform-neutral design token source | Accepted — implemented |
| [031](./031-jest-expo-for-mobile-tests.md) | jest-expo for the mobile app's tests | Accepted — implemented (2026-10-09) |
| [032](./032-uniwind-for-mobile-styling.md) | Uniwind (free) for mobile styling | Accepted — implemented (2026-10-09) |
| [033](./033-mobile-forced-upgrade.md) | Minimum supported mobile app version (forced upgrade) | Accepted — implemented (API 2026-10-08, mobile app 2026-10-09) |
| [034](./034-immediate-per-session-revocation.md) | Immediate per-session revocation (`sid` in access tokens) | Accepted — implemented (2026-10-09) |
| [035](./035-signup-referrals.md) | Signup referrals: immutable rotating codes, registration-only, no payout | Accepted |
| [036](./036-mobile-floating-tab-bar.md) | Floating tab bar, Reanimated and Lucide on mobile | Accepted — implemented (2026-10-09) |
| [037](./037-mobile-typefaces.md) | The web's typefaces on mobile, one family per weight | Accepted — implemented (2026-10-09) |
| [038](./038-mobile-app-drawer.md) | The mobile app drawer: custom Reanimated panel, corner menu button, no top bar | Accepted — implemented (2026-10-09) |
| [039](./039-mobile-auth-layout.md) | The mobile auth layout: AuthShell + AuthPage, password visibility toggle | Accepted — implemented (2026-10-09) |
| [040](./040-brand-mark.md) | One brand mark from the token source (favicons, auth panels, sidebars, mobile) | Accepted — implemented (2026-10-09) |
| [041](./041-mobile-onboarding-and-transitions.md) | Mobile onboarding (root-guarded, library-free) and named screen transitions | Accepted — implemented (2026-10-09) |
| [042](./042-mobile-demo-quick-sign-in.md) | Quick sign-in with demo accounts on mobile, dev builds only | Accepted — implemented (2026-10-09) |
| [043](./043-mobile-launch-screen-and-app-icon.md) | Mobile launch screen and app icon, generated from the token source | Accepted — implemented (2026-10-09) |
| [044](./044-mobile-motion-and-navigation-theme.md) | Mobile motion, token-coloured navigation theme, layout-level menu button, launch animation | Accepted — implemented (2026-10-10) |
| [RabbitMQ](./rabbitmq-placeholder.md) | RabbitMQ as infrastructure placeholder only | Accepted |

## Pending decisions

| Topic | Options | Where |
| --- | --- | --- |
| Managed KMS for tenant keys (`TENANT_KMS_PROVIDER`, only `local` today) | Vault / OpenBao Transit, GCP Cloud KMS, Azure Key Vault, Infisical (and AWS KMS) | [Encryption and KMS](../technical/security/encryption-and-kms.md#decision-kms-provider) |
| Malware scanner (`MALWARE_SCANNER`, only `none` today) | AWS GuardDuty Malware Protection for S3 (planned) | [Storage](../technical/storage/overview.md#malware-scanning) |
| Approximate location for device sessions (`SESSION_LOCATION_PROVIDER`, only `none` today — the `SessionLocationResolver` port and its `location_*` columns exist) | MaxMind GeoLite2 (free, needs an account, license key and periodic database download), a paid GeoIP lookup API | [ADR 034](./034-immediate-per-session-revocation.md) (device session details) |
