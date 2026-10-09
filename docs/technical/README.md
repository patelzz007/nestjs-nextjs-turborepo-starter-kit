---
title: "Technical documentation — start here"
description: "Index of the engineering documentation: setup, architecture, dos and don'ts, the generated API reference, configuration, database, security, messaging, storage, email, frontend, tooling, operations — plus the known gaps."
order: 1
author: "Platform Team"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=630&fit=crop"
tags: ["overview", "technical", "index"]
---

# Technical documentation — start here

For engineers building products on this starter kit, from principal engineers to developers with
six months of experience. Operators and product people want the [user guide](../user-guide/README.md).
AI agents (and humans) also follow the rulebook: [`AGENTS.md`](../../AGENTS.md) → `rules/`.

## Reading order for a new engineer

1. [Getting started](./getting-started.md) — run everything locally.
2. [Architecture](./architecture.md) — workspaces, runtime, request lifecycle.
3. [Dos and don'ts](./dos-and-donts.md) — the PR checklist.
4. [Adding a feature](./adding-a-feature.md) — the end-to-end checklist.
5. [API conventions](./api/README.md) and the [API reference](./api-reference/README.md).
6. [Authorization overview](./authorization/overview.md) and [Tenancy and RLS](./authorization/tenancy-and-rls.md).
7. The [junior onboarding guide](../../rules/26-junior-onboarding-guide.md) in the rulebook.

## Map

| Area | Pages |
| --- | --- |
| Basics | [Getting started](./getting-started.md) · [Architecture](./architecture.md) · [Dos and don'ts](./dos-and-donts.md) · [Adding a feature](./adding-a-feature.md) · [**Starter kit production roadmap**](./starter-kit-production-roadmap.md) |
| API | [Conventions](./api/README.md) · [**Reference (generated)**](./api-reference/README.md) · [Routes registry](./api/routes.md) · [Errors](./api/errors.md) · [List queries](./api/list-queries.md) · [Response contracts](./api/response-contracts.md) · [Analytics dashboards and exports](./api/analytics.md) · [HTTP server (Fastify)](./api/http-server.md) · [POS integration](./pos-integration.md) |
| Configuration | [API environment](./configuration/api.md) · [Frontend environment](./configuration/frontend.md) |
| Data | [Database, migrations and seed](./database.md) · [Messaging, jobs, outbox](./messaging.md) |
| Authorization | [Overview](./authorization/overview.md) · [Backend kernel](./authorization/backend.md) · [RBAC internals](./authorization/rbac.md) · [Tenancy and RLS](./authorization/tenancy-and-rls.md) · [Frontend](./authorization/frontend.md) · [Recipes](./authorization/recipes.md) · [Testing](./authorization/testing.md) · [Troubleshooting](./authorization/troubleshooting.md) · [Dos and don'ts](./authorization/dos-and-donts.md) · [Change log](./authorization/changelog.md) |
| Security | [Authentication, MFA, impersonation](./security/authentication.md) · [Token refresh](./security/token-refresh.md) · [Database security](./security/database-security.md) · [Encryption and KMS](./security/encryption-and-kms.md) · [Threat model](./security/threat-model.md) · [Data classification](./security/data-classification.md) |
| Files and email | [Storage overview](./storage/overview.md) · [**AWS S3 setup**](./storage/aws-s3.md) · [**Firebase Storage setup**](./storage/firebase.md) · [**Resend setup**](./email/resend-setup.md) · [Email templates](./email/templates.md) |
| Frontend | [Routing and URL conventions](./frontend/routing.md) · [Admin panel](./frontend/admin-panel.md) · [Analytics dashboards](./frontend/analytics-charts.md) · [Toasts](./frontend/toast.md) · [Streams (RxJS)](./frontend/streams.md) |
| Tooling | [TypeScript](./tooling/typescript.md) · [ESLint](./tooling/eslint.md) · [Dependencies](./tooling/dependencies.md) |
| Operations | [CI](./operations/ci.md) · [Local infrastructure](./operations/local-infrastructure.md) · [Observability](./operations/observability.md) · [Multi-tenancy runbook](./operations/multi-tenancy-runbook.md) · [Bootstrap the first SuperAdmin](./operations/superadmin-bootstrap.md) |
| Decisions | [Architecture decision records](../adr/README.md) |

## Known gaps

Found while verifying these docs against the code and capturing the API samples (2026-10-04). Each
is a real limitation of the current code, not of the docs.

| # | Gap | Where it shows |
| --- | --- | --- |
| 1 | `GET /geo/*?search=` answers `500` until the forward migration that creates the `pg_trgm` extension and the `*_name_trgm_idx` GIN indexes (declared in `schema.prisma`) is generated and applied | [Geography API](./api-reference/geography.md) (samples use `filter[...]` instead) |
| 4 | **Reward** referrals: no customer endpoint or UI to record a reward-scoped referral (invite link / attribution); merchant crediting at checkout works. **Signup** referrals (rotating code at registration) ship at `/rewardhub/referrals` — see [ADR 035](../adr/035-signup-referrals.md). | [Referrals](../user-guide/07-referrals.md) |
| 5 | Reward notifications have an API and client leaves but no screen | [Customer claims](../user-guide/05-customer-claims.md) |
| 6 | No command creates the first SuperAdmin on a non-demo database | [Platform setup](../user-guide/01-platform-setup.md) |
| 7 | Uploads are single requests (≤ 25 MB); chunked S3 multipart upload is not implemented | [Storage](./storage/overview.md) |
| 8 | Only `MALWARE_SCANNER=none` (GuardDuty planned) and `TENANT_KMS_PROVIDER=local` (managed KMS pending) | [Storage](./storage/overview.md#malware-scanning), [Encryption](./security/encryption-and-kms.md#decision-kms-provider) |
| 9 | Per-endpoint domain error codes are mostly not declared in the OpenAPI contract | [API reference](./api-reference/README.md) |
| 10 | No "sign out one other device"; the auth guard maps infrastructure errors during token checks to `401` | [Authentication](./security/authentication.md#known-residual-risks) |
| 11 | `apps/api`, `apps/web`, `apps/admin`, `apps/merchant`, `apps/analytics-consumer`, `packages/shared`, `packages/client`, `packages/tooling` have no package README (`rules/14`) | — |
