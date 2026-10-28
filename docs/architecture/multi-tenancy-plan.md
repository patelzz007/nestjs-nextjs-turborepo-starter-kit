---
title: "Multi-tenancy plan"
description: "The approved decisions and ordered tasks for making RewardHub multi-tenant while the same codebase keeps a single-tenant mode."
tags: ["architecture", "tenancy", "rls", "security", "migration"]
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 4
---

# Multi-Tenancy Plan

> **Status:** implemented (2026-10-20), P1–P7. Decisions D1–D31 came out of a design review and are binding. The completion report is §11; open items needing a human decision are listed there.
> **ADR:** [ADR 062](../adr/062-tenancy-modes-and-isolation.md) records them. It supersedes [ADR 007](../adr/007-tenancy-and-rls-bypass.md).
> **Implementer:** Cursor Composer (or any agent). **Every decision has already been made in this file.** Implement it exactly, verify it and report. Do not redesign.
> **Priority:** security-critical. A task that weakens tenant isolation is a failed task, even if the gate is green.

---

## 0. How to use this document (read this first, every session)

### 0.1 Your role

You are implementing, not designing. If this file is silent on something, that is a **stop-and-report** situation, not a judgment call.

### 0.2 The stop-and-report rule

Stop the current task, do not guess, and report back with the task ID, what you expected, what you found, and the evidence (paths, command output) when any of these happens:

1. A file, symbol, model, route or operation named here does not exist, or exists somewhere else.
2. The plan does not cover the situation you have hit.
3. Following the plan would break `rules/00-non-negotiables.md`, `rules/10-security-auth-authorization.md` or a lint rule.
4. A test fails, and the cause is code you did not touch in this task.
5. `prisma validate` or `db:migrate:create` rejects a schema change listed in §7 (composite foreign keys).
6. A P6 data check (MT-60) finds a violating row. **Never auto-fix data.**
7. The GitHub link check in MT-02 or MT-09 does not match.

### 0.3 The per-task loop

1. Read the files listed under **Read first**, fully.
2. Make the changes under **Do**.
3. Write the tests under **Tests**. Tests go in a `__tests__/` folder next to the code, and e2e tests go in `apps/api/test/`.
4. Run the gate from the repository root **after your last edit**:

   ```bash
   pnpm run format
   pnpm run lint        # exit 0
   pnpm run typecheck   # exit 0
   pnpm run test        # exit 0
   ```

5. **Gate `+e2e`** also means `pnpm test:e2e`, run against a **throwaway database**, never against the `.env` database, which holds real data (see §0.5).
6. **Gate `+ci`** also means `pnpm run ci:local`.
7. Commit only when the human asks you to.

A phase is finished only when its **last** task passes `+e2e +ci`. Never start phase N+1 while phase N is red (D30).

### 0.4 Forbidden ways to make the gate pass

- `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or editing the ESLint config.
- Using `.skip`, `.only` or `.todo`, or deleting a test or weakening its assertions.
- Mocking away the thing under test. **Isolation tests must hit real Postgres as `app_runtime`; a mocked repository proves nothing (§9).**
- Hand-written migration SQL. Migrations are generated from `schema.prisma` with `pnpm db:migrate:create`.
- Granting `BYPASSRLS`, disabling RLS, or adding an `allTables` scope to unblock anything.
- `any`, `unknown`, `never` (outside exhaustiveness checks), `as`, `as const`, `typeof`/`Array.isArray` at runtime, or `[0]` indexing.

### 0.5 Databases and secrets

- **Never** run e2e, seeds or resets against the database in `apps/api/.env`. It holds the superadmin's real GitHub link.
- e2e and experiments use throwaway databases, `postgresql://postgres:postgres@localhost:5432/<name>?schema=public`.
- Never print database credentials or tokens. Mask them in any output you paste.
- Do not edit the user's `.env` files. Only `.env.example` files change (MT-72).

---

## 1. Decision log (binding; do not re-litigate)

| #       | Decision                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1      | One codebase, with RewardHub as the product inside this starter kit. There is no fork. `.env.example` documents both modes. RewardHub's deploy config and CI set `TENANCY_ENABLED=true`.                                                                                                                                                                                     |
| D2      | `.env.example` defaults to multi mode. The single-mode block (`TENANCY_ENABLED=false`, `DEFAULT_TENANT_ID=`) is documented below it, commented out.                                                                                                                                                                                                                          |
| D3      | Delete `staffBypassesRls` and the `platform.staff_single_tenant` operation. In single mode, staff are ordinary users of the default tenant. Admin-console reads go through narrowed, audited operations.                                                                                                                                                                     |
| D4      | Superadmin and admin mean **RewardHub's own platform staff** (the admin app). They get cross-tenant reach only on platform routes, through narrowed operations. On tenant routes they are ordinary users unless they hold an approved `SupportAccessGrant`.                                                                                                                  |
| D5/D19  | No blanket bypass is possible. The `allTables` scope kind is deleted from the type. All **88** operations are narrowed (24 already are, 60 are "not yet narrowed", and 4 are request-wide). `request.pre_handler` becomes named auth-table lookups. Every `@RlsBypass()` route gets its own operation. `platform.superadmin` and `platform.staff_single_tenant` are deleted. |
| D6      | User requests resolve the tenant from `:tenantSlug` only. Machine requests (POS terminals, API keys) resolve the tenant and location from the authenticated credential. A slug or `tenantId` sent by a machine principal is rejected. The `x-organization-id` header is removed. These are the **only two** trusted sources.                                                 |
| D7/D18  | Customers are `User` rows with no membership. Their claims and wallet are already user-owned. No `Customer`, `LoyaltyAccount` or `CustomerClaim` tables are added.                                                                                                                                                                                                           |
| D8/D25  | Lifecycle is checked at tenant resolution on **every request, in both modes**, including a default tenant suspended after boot. Only routes marked `@TenantLifecycleRoute()` are exempt.                                                                                                                                                                                     |
| D9      | `FORCE ROW LEVEL SECURITY`, plus a runtime-role proof (in startup **and** CI) that `app_runtime` cannot bypass RLS. Separate migration and runtime logins go in the runbook.                                                                                                                                                                                                 |
| D10/D31 | Composite `(tenantId, id)` uniques first, then composite foreign keys, preceded by a data check. The exact list is §7. Composer must not add or omit any.                                                                                                                                                                                                                    |
| D11/D26 | CI runs the full e2e suite in **multi** mode, a targeted single-mode suite, and an RLS runtime-role suite. A dedicated two-tenant fixture with fixed ids backs them: Tenant A (KL, Malacca), Tenant B (JB) and Customer C. The demo seed is untouched apart from the rename.                                                                                                 |
| D12     | Keep the `TENANCY_ENABLED` name. It is parsed once into `TenancyMode = "single" \| "multi"` (zod) and injected. Nothing reads the raw variable outside config.                                                                                                                                                                                                               |
| D13     | This file plus ADR 062.                                                                                                                                                                                                                                                                                                                                                      |
| D14     | The rename reaches the database through a **second pre-release baseline reset** (regenerate the one `init` migration and move `migrations-baseline.json`). `db:carry-github-link` exports the dev DB's GitHub link before the reset and imports it after. No hand-written SQL, no expand/contract.                                                                           |
| D15     | P1 is the rename only, mechanical, with zero behaviour change, and its full gate is green before P2.                                                                                                                                                                                                                                                                         |
| D16     | The model and route rename is exactly the §5 mapping.                                                                                                                                                                                                                                                                                                                        |
| D17     | `Store` and `StoreMembership` stay as they are, apart from renaming `organizationId` to `tenantId`. Merging them is a follow-up (§12).                                                                                                                                                                                                                                       |
| Q5      | API routes move from `/orgs/:tenantSlug/…` to `/tenants/:tenantSlug/…`. Merchant URLs move from `/orgs/[orgSlug]` to `/t/[tenantSlug]`, with old URLs redirected (301). On-screen copy keeps "Store" and "Business". The word "organization" is banned in code, data, env and docs, **not** in UI text.                                                                      |
| D20     | Every platform (admin-app) route declares `@PlatformOperation("<op>")`, and a coverage test fails if one is missing. Identity alone never widens scope.                                                                                                                                                                                                                      |
| D21     | Impersonating a member of tenant X requires an approved, unexpired `SupportAccessGrant` for X. The grant id goes into the audit entry.                                                                                                                                                                                                                                       |
| D22     | Context is set transaction-locally only, with `set_config('app.current_tenant_id', …, true)`. The session-level stamp at pool checkout is removed. DB-005 proves no leak.                                                                                                                                                                                                    |
| D23     | Strict zod contracts reject any `tenantId` in a request with **400**. Another tenant's resource id returns **404**.                                                                                                                                                                                                                                                          |
| D24     | Migrations change schema only. Seeds and data checks run through named `seed.*` operations.                                                                                                                                                                                                                                                                                  |
| D27     | uuid v7 ids are kept (the spec's `cuid()` was illustrative). The spec's §16.7 item is dropped. The operation count is 88.                                                                                                                                                                                                                                                    |
| D28     | The customer marketplace is one named operation, `marketplace.published_rewards.read`, limited to published rewards and the merchant's public profile.                                                                                                                                                                                                                       |
| D29     | Events, outbox and inbox payloads rename `organizationId` to `tenantId` in P1. `packages/messaging` and `apps/analytics-consumer` change in the same change, with no dual fields.                                                                                                                                                                                            |
| D30     | Phase order P1 → P7, each with a full gate.                                                                                                                                                                                                                                                                                                                                  |

### 1.1 Calls made while writing this plan (flagged for the human; reverse before starting if wrong)

- **C1, lifecycle states.** The schema enum is `OrganizationLifecycleState` (renamed to `TenantLifecycleState`), with the values `PROVISIONING`, `ACTIVE`, `RESTRICTED`, `SUSPENDED`, `PENDING_DELETION` and `DELETED`.
  - **Ordinary routes** accept `ACTIVE` and `RESTRICTED`. `RESTRICTED` keeps whatever narrower rules the code already applies.
  - **`@TenantLifecycleRoute()` routes** additionally accept `PROVISIONING`, `SUSPENDED` and `PENDING_DELETION`.
  - **`DELETED`** is rejected everywhere (404).
  - **Membership:** only `ACTIVE` is accepted. `SUSPENDED` and `PENDING` are rejected (403), except on the "leave tenant" lifecycle route.
- **C2, composite foreign keys with `onDelete: SetNull`.** Six relations in §7 use `SetNull`. On a composite foreign key, Postgres would also null `tenantId`, which is non-null, so those relations become `onDelete: Restrict`. That loses nothing, because every business entity is soft-deleted and never hard-deleted. `Cascade` relations stay `Cascade`.
- **C3, scope of `FORCE ROW LEVEL SECURITY`.** It goes on **every table that has RLS enabled** in `prisma/rls/table-manifest.ts`, not only the tenant tables. The owner-bypass risk is identical for user-owned and bypass-only tables.

---

## 2. Verified repository facts (as of 2026-10-20)

If one of these is wrong, stop and report (§0.2).

### 2.1 Tenancy today

| Concern             | Where                                                                                                                                                      | Today                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode config         | `apps/api/src/config/tenancy.config.ts` (`TenancyConfigService`)                                                                                           | `enabled: boolean`, `singleTenantOrganizationId`, and `staffBypassesRls = !enabled`.                                                                                                                                                              |
| Env rules           | `apps/api/src/config/api-config/api-env.rules.ts` (~line 180)                                                                                              | `DEFAULT_ORGANIZATION_ID` (uuid) is required when tenancy is off.                                                                                                                                                                                 |
| Boot check          | `apps/api/src/platform/infrastructure/tenancy/default-organization.{service,repository}.ts`                                                                | Verifies the default org at boot through `tenancy.default_organization.verify`.                                                                                                                                                                   |
| Actor policy        | `apps/api/src/platform/presentation/http/security/actor-tenancy.policy.ts`                                                                                 | Wraps the config for the principal.                                                                                                                                                                                                               |
| Principal + scope   | `apps/api/src/platform/presentation/http/security/request-principal.ts`                                                                                    | `UserAccessScope = "tenant" \| "superadmin" \| "staff_single_tenant"`. `boundOrganizationId()` returns the default org in single mode and the request org (or null) in multi. A superadmin always gets `systemRlsContext("platform.superadmin")`. |
| Tenant from request | `apps/api/src/contexts/authorization/infrastructure/kernel/authorization-context.resolver.ts`                                                              | Reads the `x-organization-id` header, `params.organizationId`/`orgId`, query or body, and `params.orgSlug` through `TenantMembershipService.organizationIdForRouteKey` (slug, slug history or uuid). It then verifies membership.                 |
| Guard               | `apps/api/src/platform/presentation/http/security/guards/authorization.guard.ts`                                                                           | Also references the header.                                                                                                                                                                                                                       |
| RLS context         | `apps/api/src/platform/infrastructure/unit-of-work/actor-to-rls-context.ts`                                                                                | `TENANT_DATA_SCOPE` and `USER_OWNED_DATA_SCOPE`.                                                                                                                                                                                                  |
| Pool                | `apps/api/src/prisma/rls-pool.ts`                                                                                                                          | Stamps a **session-level** `set_config(…, false)` from `rlsStorage` at checkout.                                                                                                                                                                  |
| Transactions        | `apps/api/src/prisma/tenant-transaction.service.ts`                                                                                                        | Stamps transaction-locally (`checkedOutAs`).                                                                                                                                                                                                      |
| Interceptor         | `apps/api/src/platform/presentation/http/interceptors/rls.interceptor.ts`                                                                                  | Opens the request's `rlsStorage` context.                                                                                                                                                                                                         |
| Bypass decorator    | `apps/api/src/platform/presentation/http/security/decorators/rls-bypass.decorator.ts`                                                                      | `@RlsBypass()` sets boolean metadata. It is used in **26** files.                                                                                                                                                                                 |
| Support access      | `apps/api/src/contexts/authorization/application/{ports/support-access.port.ts,services/support-access-grant-locator.ts,services/support-access-audit.ts}` | The `SupportAccessGrant` model exists.                                                                                                                                                                                                            |
| Impersonation       | `apps/api/src/contexts/identity/{presentation/http/impersonation.controller.ts,domain/policies/impersonation-start.policy.ts}`                             | Does not check for a support grant today.                                                                                                                                                                                                         |

### 2.2 Database and RLS

- `app_runtime` is `NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS`, reached with `SET ROLE` (`apps/api/prisma/rls/00-app-helpers.sql`). The connecting login owns the tables. **No table uses `FORCE ROW LEVEL SECURITY`.**
- RLS settings in use are `app.current_user_id`, `app.current_organization_id`, `app.rls_bypass`, `app.system_operation`, `app.current_api_key_id` and `app.current_api_key_location_id`.
- RLS SQL lives in `apps/api/prisma/rls/*.sql`. The table classification is in `apps/api/prisma/rls/table-manifest.ts`, and the system-operation scopes are generated into `00-system-operation-scopes.sql` by `pnpm db:generate-system-operation-scopes`.
- The registry is `apps/api/src/prisma/system-operation.registry.ts`, with 88 operations: 24 `tables(...)`, 60 `NOT_YET_NARROWED`, and 4 `REQUEST_SCOPE` (`request.pre_handler`, `route.rls_bypass`, `platform.superadmin` and `platform.staff_single_tenant`).
- Migrations are one baseline, `apps/api/prisma/migrations/20261019182652_init/`, with the marker `apps/api/prisma/migrations-baseline.json`.
- The scripts are `db:migrate:create`, `db:generate`, `db:seed`, `db:apply-security`, `db:check-rls-manifest`, `db:check-seed-coverage`, `db:check-drift` and `db:generate-system-operation-scopes`.
- CI is `.github/workflows/ci.yml`. Its `e2e` job runs `pnpm --filter @workspace/api test:e2e`, and no CI job sets `TENANCY_ENABLED`, so every test today runs single-tenant.

### 2.3 Size of the rename

About 9,700 case-insensitive occurrences of "organization" across about 1,100 files in `apps/`, `packages/`, `docs/` and `rules/`. That includes:

- 15 `Organization*` models and 116 `organizationId` columns
- 43 API controllers under `orgs/:tenantSlug`
- the context `apps/api/src/contexts/organizations`
- `packages/messaging/src/inbox/*`

### 2.4 Table RLS classes (from the `/// RLS:` annotations in `schema.prisma`)

| Class                                    | Models                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant (`TENANT`, `organization`, `org`) | AuthorizationPolicyDraft, AuthorizationPolicyVersion, Organization, OrganizationAccessRequest, OrganizationAuditLog, OrganizationInvitation, OrganizationInvitationLocationScope, OrganizationLocation, OrganizationMerchantProfile, OrganizationSlugHistory, Store, StoreMembership, TenantEncryptionKey, TenantPlacement, Reward, RewardImage, RewardLocationScope, RewardRedemption, OrganizationApiKey |
| Membership                               | OrganizationMembership, OrganizationMembershipLocationScope                                                                                                                                                                                                                                                                                                                                                |
| Operational                              | AuthorizationPolicySimulation, OrganizationLifecycleEvent, SupportAccessGrant                                                                                                                                                                                                                                                                                                                              |
| Through a parent (`via`)                 | FileVariant, OrganizationAsset, OrganizationKybFile, OrganizationTerminal, ProductImage, UserAvatar                                                                                                                                                                                                                                                                                                        |
| User-owned (D7)                          | User, BackupCode, GithubAccountLink, MfaRecoveryRequest, PasswordHistory, PasswordResetToken, RefreshToken, TwoFactorLoginChallenge, TwoFactorPendingSetup, UserPermission, UserRole, RewardClaim, RewardLegalAcceptance, RewardNotification, RewardOtpChallenge, SignupReferralCode, RewardReferral, SignupReferral, StoredFile (owner)                                                                   |
| Bypass-only                              | AuthorizationAudit, ImpersonationSession, InboxProcessedEvent, MfaRecoveryAuditLog, PermissionAuditLog, RewardAuditLog, DataChangeLog, EmailLog, ImpersonationAuditLog, OutboxEvent, InboxDeadLetter                                                                                                                                                                                                       |
| Catalogue / global                       | CapabilityDefinition, Permission, PolicyDefinition, Role, RolePermission, ResourceAcl, Region, Subregion, Country, State, City, Product, SampleCategory                                                                                                                                                                                                                                                    |
| **No annotation**                        | AnalyticsEvent, AuditLog, EmailDeliveryEvent, GithubWebhookDelivery, GithubWebhookSubscription, PlatformResourceIdempotencyRecord, **RewardSale**                                                                                                                                                                                                                                                          |

`RewardSale` has `organizationId` and API-key policies in `40-api-key-principal.sql`, but no `/// RLS:` annotation. MT-50 classifies it as tenant-owned and annotates it.

---

## 3. Vocabulary

| Term                 | Meaning                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tenant**           | The customer company and the isolation boundary. The `Tenant` model; the `tenantId` column.                                                            |
| **Location**         | A branch inside a tenant. It is never a tenant.                                                                                                        |
| **Membership**       | A user ↔ tenant link, with a role and location scopes.                                                                                                 |
| **Customer**         | A `User` with no membership. Their data is user-owned.                                                                                                 |
| **Platform staff**   | RewardHub's own superadmins and admins (the admin app). They are **not** tenant admins.                                                                |
| **Tenant context**   | `{ tenantId }`, trusted and server-derived. It comes only from the slug (user) or the credential (machine), or from the default tenant in single mode. |
| **System operation** | A named, audited privileged operation with an explicit table allowlist.                                                                                |

---

## 4. Target architecture

### 4.1 Request flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Authentication
    participant T as TenantResolver
    participant L as Lifecycle check
    participant M as Membership check
    participant Z as Authorization
    participant U as Handler
    participant DB as Postgres (FORCE RLS)

    C->>A: request
    A->>T: principal (user | machine)
    alt single mode
        T->>T: tenantId = boot-verified DEFAULT_TENANT_ID (a slug for another tenant → 404)
    else multi mode, user
        T->>DB: tenant by :tenantSlug (slug, slug history) — missing/unknown → 404
    else machine principal
        T->>T: tenantId + locationId from the credential (slug/tenantId sent → 400)
    end
    T->>L: tenant state (every request, both modes)
    L->>M: allowed (or @TenantLifecycleRoute)
    M->>DB: ACTIVE membership(userId, tenantId) — users only
    M->>Z: TenantContext { tenantId }
    Z->>U: permission + location scope
    U->>DB: BEGIN#59; set_config('app.current_tenant_id', tenantId, true)#59; queries#59; COMMIT
```

### 4.2 Request kinds

| Request kind                         | Tenant source                                        | RLS context                                                    |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| Tenant route (user)                  | `:tenantSlug` (multi) or the default tenant (single) | tenant + user                                                  |
| Customer route                       | none                                                 | user-owned (`app.current_user_id`)                             |
| Machine route (POS)                  | the credential                                       | API key + location                                             |
| Platform route (admin app)           | none                                                 | the operation named by `@PlatformOperation`                    |
| Marketplace read                     | none                                                 | `marketplace.published_rewards.read`                           |
| Public pre-auth (`@RlsBypass` today) | none                                                 | its own named operation (MT-43)                                |
| Tenant route by a platform admin     | `:tenantSlug`                                        | tenant, **only** with an active `SupportAccessGrant` (D4, D21) |

### 4.3 Composition root

`TenancyMode` is parsed in `api-env.rules.ts` and exposed by `TenancyConfigService.mode`. One provider token, `TENANT_SOURCE`, is bound at module setup:

- `"single"` → `FixedTenantSource` (the default tenant, boot-verified)
- `"multi"` → `RouteTenantSource` (the slug lookup)

The machine-credential path is the same in both modes. **No other code branches on the mode.** An architecture test (MT-21) fails if `TenancyMode`, `.mode` or `TENANCY_ENABLED` appears outside `config/` and the `platform/infrastructure/tenancy/` sources.

---

## 5. Rename mapping (D16, D29, Q5)

| Old                                                                                                                                                    | New                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `Organization`                                                                                                                                         | `Tenant`                                                                                |
| `OrganizationLocation`                                                                                                                                 | `Location`                                                                              |
| `OrganizationMembership`                                                                                                                               | `Membership`                                                                            |
| `OrganizationMembershipLocationScope`                                                                                                                  | `MembershipLocationScope`                                                               |
| `OrganizationSlugHistory`                                                                                                                              | `TenantSlugHistory`                                                                     |
| `OrganizationMerchantProfile`                                                                                                                          | `TenantMerchantProfile`                                                                 |
| `OrganizationInvitation`                                                                                                                               | `TenantInvitation`                                                                      |
| `OrganizationInvitationLocationScope`                                                                                                                  | `TenantInvitationLocationScope`                                                         |
| `OrganizationAccessRequest`                                                                                                                            | `TenantAccessRequest`                                                                   |
| `OrganizationLifecycleEvent`                                                                                                                           | `TenantLifecycleEvent`                                                                  |
| `OrganizationAuditLog`                                                                                                                                 | `TenantAuditLog`                                                                        |
| `OrganizationAsset`                                                                                                                                    | `TenantAsset`                                                                           |
| `OrganizationKybFile`                                                                                                                                  | `TenantKybFile`                                                                         |
| `OrganizationApiKey`                                                                                                                                   | `TenantApiKey`                                                                          |
| `OrganizationTerminal`                                                                                                                                 | `TenantTerminal`                                                                        |
| `Organization*` enums (`OrganizationLifecycleState`, `OrganizationMembershipStatus`, `OrganizationLocationStatus`, `OrganizationLocationScopeType`, …) | `Tenant*`, except that location and membership enums take `Location*` and `Membership*` |
| `organizationId` (columns, DTO fields, event payloads)                                                                                                 | `tenantId`                                                                              |
| `organization` relation fields                                                                                                                         | `tenant`                                                                                |
| `app.current_organization_id`                                                                                                                          | `app.current_tenant_id`                                                                 |
| `DEFAULT_ORGANIZATION_ID`                                                                                                                              | `DEFAULT_TENANT_ID`                                                                     |
| `apps/api/src/contexts/organizations`                                                                                                                  | `apps/api/src/contexts/tenancy`                                                         |
| `apps/*/contexts/organizations` (frontend)                                                                                                             | `apps/*/contexts/tenancy`                                                               |
| API `/orgs/:tenantSlug/…`                                                                                                                              | `/tenants/:tenantSlug/…`                                                                |
| Merchant `app/orgs/[orgSlug]/…`                                                                                                                        | `app/t/[tenantSlug]/…`, plus a 301 from `/orgs/:slug/*`                                 |
| `organizationSlug` (contract fields)                                                                                                                   | `tenantSlug`                                                                            |
| Seed ids (`prisma/seed/organization-seed-ids.ts`)                                                                                                      | `tenant-seed-ids.ts`, with **the same uuid values**                                     |
| `tenancy.default_organization.verify`                                                                                                                  | `tenancy.default_tenant.verify`                                                         |

**Not renamed:**

- UI copy ("Store", "Business").
- Historical ADRs, which stay as written and are only linked forward.
- `docs/architecture/ddd-cqrs-*.md`, which is history (add one line at the top pointing here).
- The names of third-party APIs.

**Exit check (MT-08):** `rg -i "organi[sz]ation" apps packages rules docs --glob '!docs/adr/0[0-5]*' --glob '!docs/adr/06[01]*' --glob '!docs/architecture/ddd-cqrs-*'` returns only UI copy strings, each listed in the PR with its file.

---

## 6. System operations target (D19, D20, D28)

- `SystemOperationScope` becomes `{ readonly kind: "tables"; readonly tables: readonly TableName[] }` only. `TableName` is derived from the Prisma model names, so a typo does not compile. `allTables`, `REQUEST_SCOPE`, `NOT_YET_NARROWED` and `AllTablesReason` are deleted.
- The following operations are **deleted**:
  - `platform.superadmin`
  - `platform.staff_single_tenant`
  - `route.rls_bypass`
  - `request.pre_handler`
- **New operations:**

| Operation                                              | Tables                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `auth.principal.lookup`                                | User, UserRole, UserPermission, Role, RolePermission, Permission, RefreshToken, ImpersonationSession |
| `auth.membership.lookup`                               | Membership, MembershipLocationScope, Tenant, TenantSlugHistory                                       |
| `auth.api_key.lookup`                                  | TenantApiKey, TenantTerminal, Location                                                               |
| `auth.support_grant.lookup`                            | SupportAccessGrant                                                                                   |
| `marketplace.published_rewards.read`                   | Reward, RewardImage, RewardLocationScope, Location, Tenant, TenantMerchantProfile                    |
| one `public.<flow>` per current `@RlsBypass()` handler | exactly the tables that handler touches (MT-43 lists them by reading each handler)                   |
| `seed.<area>` per seed module (D24)                    | the tables that seed writes                                                                          |
| `tenancy.data_check` (MT-60)                           | the §7 child and parent tables, read-only                                                            |

- Each of the 60 `NOT_YET_NARROWED` operations gets the exact tables its call sites touch. Find them with `rg "<operation name>" apps/api/src` and read each call site.
- `@RlsBypass()` is replaced by `@PublicOperation("<op>")`. Every admin-app controller route declares `@PlatformOperation("<op>")`. Both decorators take `SystemOperationName`, so an unknown name does not compile.
- `pnpm db:generate-system-operation-scopes` and `db:check-rls-manifest` stay the enforcement, plus a new unit test that no definition can express "all tables" (a type-level test with `expectTypeOf`).

---

## 7. Composite foreign keys (D10, D31; generated from `schema.prisma` on 2026-10-20, names after the rename)

**Parents that gain `@@unique([tenantId, id])`:** `Location`, `Membership`, `Reward`, `Store` and `TenantApiKey`. None has it today.

| #   | Child (FK columns)                                     | Parent (columns)              | Today             | Becomes                     |
| --- | ------------------------------------------------------ | ----------------------------- | ----------------- | --------------------------- |
| 1   | `MembershipLocationScope (tenantId, locationId)`       | `Location (tenantId, id)`     | optional, Cascade | optional, Cascade           |
| 2   | `MembershipLocationScope (tenantId, membershipId)`     | `Membership (tenantId, id)`   | required, Cascade | required, Cascade           |
| 3   | `Reward (tenantId, parentConsumerRewardId)`            | `Reward (tenantId, id)`       | optional, SetNull | optional, **Restrict** (C2) |
| 4   | `Reward (tenantId, referrerRewardId)`                  | `Reward (tenantId, id)`       | optional, SetNull | optional, **Restrict** (C2) |
| 5   | `RewardImage (tenantId, rewardId)`                     | `Reward (tenantId, id)`       | required, Cascade | required, Cascade           |
| 6   | `RewardLocationScope (tenantId, locationId)`           | `Location (tenantId, id)`     | required, Cascade | required, Cascade           |
| 7   | `RewardLocationScope (tenantId, rewardId)`             | `Reward (tenantId, id)`       | required, Cascade | required, Cascade           |
| 8   | `RewardRedemption (tenantId, locationId)`              | `Location (tenantId, id)`     | optional, SetNull | optional, **Restrict** (C2) |
| 9   | `RewardSale (tenantId, apiKeyId)`                      | `TenantApiKey (tenantId, id)` | optional, SetNull | optional, **Restrict** (C2) |
| 10  | `RewardSale (tenantId, locationId)`                    | `Location (tenantId, id)`     | optional, SetNull | optional, **Restrict** (C2) |
| 11  | `Store (tenantId, locationId)`                         | `Location (tenantId, id)`     | required, Cascade | required, Cascade           |
| 12  | `StoreMembership (tenantId, storeId)`                  | `Store (tenantId, id)`        | required, Cascade | required, Cascade           |
| 13  | `TenantApiKey (tenantId, locationId)`                  | `Location (tenantId, id)`     | optional, SetNull | optional, **Restrict** (C2) |
| 14  | `TenantInvitationLocationScope (tenantId, locationId)` | `Location (tenantId, id)`     | required, Cascade | required, Cascade           |
| 15  | `TenantTerminal (tenantId, apiKeyId)`                  | `TenantApiKey (tenantId, id)` | optional, SetNull | optional, **Restrict** (C2) |
| 16  | `TenantTerminal (tenantId, locationId)`                | `Location (tenantId, id)`     | required, Cascade | required, Cascade           |

**Notes:**

- An optional foreign key keeps its id column nullable. Postgres `MATCH SIMPLE` skips the check when `locationId` is NULL, which is the intended behaviour.
- `tenantId` is shared by several relations on the same model, which Prisma allows.
- If `prisma validate` rejects any row, stop and report (§0.2.5). Do not drop a row.
- User-owned tables that reference `Reward` (`RewardClaim`, `RewardNotification`, …) have no `tenantId` and are **not** in this list. Their integrity comes from the user-owned RLS policy and the application check.

---

## 8. Test matrix (D11)

Every ID below is a real automated test against Postgres as `app_runtime`, in `apps/api/test/tenancy/`.

### 8.1 Fixture (D26)

`apps/api/test/support/two-tenant-fixture.ts` exports fixed uuid v7 constants and `seedTwoTenantFixture(prisma)`. It writes through `seed.test_fixture`, and every column is set explicitly.

- **Tenant A** (`ACTIVE`):
  - Locations: A-KL and A-Malacca
  - Members: A-Owner (all locations), A-KL-Manager (KL only) and A-Cashier (KL)
  - Data: Reward A (scoped to KL), Redemption A, and an API key plus terminal at KL
- **Tenant B** (`ACTIVE`):
  - Locations: B-JB
  - Members: B-Owner
  - Data: Reward B and Redemption B
- **Tenant S** (`SUSPENDED`): one location and S-Owner (for the lifecycle tests).
- **Customer C:** a user with no membership, and a claim on Reward A.
- **Platform admin P:** a superadmin, with no support grant until a test creates one.

### 8.2 Suites

| Suite            | Mode   | Command                                                                  | IDs                                                         |
| ---------------- | ------ | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Full e2e         | multi  | `pnpm --filter @workspace/api test:e2e` (CI sets `TENANCY_ENABLED=true`) | everything existing                                         |
| Tenancy, multi   | multi  | `pnpm --filter @workspace/api test:e2e:tenancy`                          | MT-001…007, LOC-001…004, CU-001…003, LIFE-_, PLAT-_, MACH-* |
| Tenancy, single  | single | `pnpm --filter @workspace/api test:e2e:tenancy:single`                   | ST-001…005                                                  |
| RLS runtime role | both   | `pnpm --filter @workspace/api test:e2e:rls`                              | DB-001…007                                                  |

### 8.3 Test IDs (each one becomes an `it(...)` name that starts with the ID)

**Single mode:**

- **ST-001:** records created on the default tenant belong to it.
- **ST-002:** a `tenantId` in the body or query returns 400. A slug of Tenant B returns 404. No B rows are ever returned.
- **ST-003:** boot fails when `DEFAULT_TENANT_ID` is missing, unknown or deleted.
- **ST-004:** a default tenant suspended after boot rejects ordinary routes and allows lifecycle routes.
- **ST-005:** staff with admin access get no RLS bypass, and P sees no tenant rows without a grant.

**Multi mode:**

- **MT-001:** a member reads their own tenant.
- **MT-002:** A-Owner reading Reward B by id gets 404.
- **MT-003:** a tenant route without a slug or with an unknown slug gets 404, and `DEFAULT_TENANT_ID` (set in the env) is never used.
- **MT-004:** a user with no membership in the tenant gets 403.
- **MT-005:** a `SUSPENDED` membership gets 403 even with a valid JWT.
- **MT-006:** creating a redemption in A with B's location is rejected by the application (404) **and** by the composite FK (a direct insert as `app_runtime` fails).
- **MT-007:** an update carrying `tenantId` gets 400, and a direct `UPDATE` changing `tenantId` is denied by RLS `WITH CHECK`.

**Location scope:**

- **LOC-001:** the KL manager reads KL.
- **LOC-002:** the KL manager reading Malacca is rejected with no rows.
- **LOC-003:** reading B-JB is rejected.
- **LOC-004:** A-Owner is limited to tenant A.

**Customers:**

- **CU-001:** C reads their own claim.
- **CU-002:** C cannot read another customer's claim.
- **CU-003:** C calling a tenant route gets 403, because customer routes never set a tenant.

**Lifecycle:**

- **LIFE-001:** S-Owner's ordinary routes get 403 with `TENANT_SUSPENDED`.
- **LIFE-002:** each `@TenantLifecycleRoute()` route works for S-Owner.
- **LIFE-003:** a `DELETED` tenant gets 404.

**Platform staff:**

- **PLAT-001:** P on a platform route reads only that operation's tables.
- **PLAT-002:** P on `/tenants/a/...` without a grant gets 403.
- **PLAT-003:** with an approved grant, P can read A, and the audit entry has the grant id.
- **PLAT-004:** impersonating A-Cashier without a grant gets 403, and with one the session starts and the audit entry has the grant id.
- **PLAT-005:** the coverage test finds every admin route with `@PlatformOperation` (unit test, MT-44).

**Machine principals:**

- **MACH-001:** a terminal resolves to tenant A and location KL.
- **MACH-002:** a machine request carrying `:tenantSlug` or `tenantId` gets 400.
- **MACH-003:** A's API key cannot redeem against B's reward (404).

**RLS runtime role:**

- **DB-001:** with no `app.current_tenant_id`, a tenant table returns 0 rows and an insert is denied.
- **DB-002:** with A's setting, B's rows are invisible.
- **DB-003:** inserting with B's `tenantId` under A's setting is denied.
- **DB-004:** updating `tenantId` is denied.
- **DB-005:** reuse a pooled connection after a COMMIT and after a ROLLBACK, and assert that `current_setting('app.current_tenant_id', true)` is empty and no rows show.
- **DB-006:** `pg_roles` for `app_runtime` has `rolsuper = false` and `rolbypassrls = false`. Every RLS-enabled table has `relforcerowsecurity = true`. As the **owner login** with no context, a forced table returns 0 rows.
- **DB-007:** count, aggregate, analytics and export queries under A never include B.

---

## 9. Phases and tasks

**Gate legend:** **G** = format + lint + typecheck + test. `+e2e` and `+ci` are as in §0.3. Every phase's **last** task is `G +e2e +ci`.

### P1 — Rename (D14, D15, D16, D29, Q5). No behaviour change.

**MT-01: Baseline the branch**

- **Read first:** `AGENTS.md`, `rules/00`, `rules/08`, this file.
- **Do:** create the branch `feat/multi-tenancy` from the current `refactor/ddd-cqrs` head, once that branch has merged or the human says otherwise. Run `G +e2e +ci` and record the pass counts in the PR draft.
- **Gate:** G +e2e.

**MT-02: `db:carry-github-link` script**

- **Read first:** the `GithubAccountLink` model, the GitHub token encryption code (`rg "GithubAccountLink" apps/api/src`) and `docs/technical/` on encryption keys.
- **Do:** add `apps/api/scripts/db/carry-github-link.ts`, with a `db:carry-github-link` script in `apps/api/package.json`:
  - `export --out <file>` writes the superadmin's `GithubAccountLink` row exactly as stored (ciphertext, never decrypted) to a JSON file with mode `0600`, outside the repo (default `~/.starter-kit/github-link.json`). It also writes the user's email so the link can be matched after a reseed.
  - `import --in <file>` finds the user by email and upserts the row, keeping every column.
  - It writes through a new operation, `seed.github_link.carry` (`GithubAccountLink`, `User`).
  - It never logs the token.
- **Tests:** `scripts/db/__tests__/carry-github-link.spec.ts` covers round-tripping a row, a missing user (the import stops with a message and no partial write) and the file permissions.
- **Gate:** G.

**MT-03: Rename the Prisma schema and regenerate the baseline**

- **Do:**
  1. Run `pnpm tools db:carry-github-link export` against the dev DB. **Do not proceed** until the file exists.
  2. Apply §5 to `apps/api/prisma/schema.prisma`: models, enums, columns and relation names, plus `/// RLS:` comments that say "organization". Keep `/// @extends BaseModel` blocks untouched apart from the model names.
  3. Delete `apps/api/prisma/migrations/20261019182652_init/` and run `pnpm db:migrate:create --name init` against a **throwaway** database to generate the new baseline.
  4. Set `migrations-baseline.json` `baseline` to the new directory name. Its `reason` is: "Second pre-release reset: Organization → Tenant rename (multi-tenancy plan D14). No shared or deployed database has run the previous baseline." `since` is the date.
  5. Run `pnpm db:generate`.
- **Tests:** `packages/tooling` migration-history tests pass (the marker test checks that the directory exists).
- **Gate:** typecheck is expected to be red until MT-04 to MT-07 land. P1 has one green gate, at MT-09.

**MT-04: Rename the RLS SQL, manifest and registry**

- **Do:**
  - `apps/api/prisma/rls/*.sql` and `*.ts`: table names, `app.current_organization_id` → `app.current_tenant_id`, and policy names that contain "organization".
  - Registry operation names and descriptions per §5.
  - Regenerate the scopes with `pnpm db:generate-system-operation-scopes`.
- **Tests:** `prisma/rls/__tests__/*` and the manifest check.

**MT-05: Rename the API code**

- **Do:**
  - `git mv apps/api/src/contexts/organizations apps/api/src/contexts/tenancy`, then rename the symbols, files and DTO fields per §5.
  - Controllers move from `apiPath("/orgs/:tenantSlug/…")` to `apiPath("/tenants/:tenantSlug/…")`, and route params from `orgSlug` to `tenantSlug`.
  - Rename `DEFAULT_ORGANIZATION_ID` to `DEFAULT_TENANT_ID` in the env schema, `.env.example`, CI (`.github/actions/write-api-ci-env/action.yml`) and docs.
  - `docs/technical/` gets a "Renamed variables" note: deployments must set the new name, and the old name fails boot with a message naming the new one. That error is the documented migration path.
- **Tests:** rename the existing specs. They must pass unchanged in behaviour.

**MT-06: Rename shared contracts, messaging and analytics-consumer (D29)**

- **Do:**
  - In `packages/shared`: rename the contract fields and schemas (`organizationSlug` → `tenantSlug`, `organizationId` → `tenantId`).
  - In `packages/messaging`: rename the event, outbox and inbox payloads.
  - In `apps/analytics-consumer`: rename the consumers.
  - Regenerate the API client and OpenAPI output with the existing scripts.
- **Tests:** contract snapshot tests are updated **only** for the renamed keys. The diff must show nothing else.

**MT-07: Rename the frontend**

- **Do:**
  - `apps/{web,merchant,admin}/contexts/organizations` → `contexts/tenancy`, and `packages/client` likewise.
  - `apps/merchant/app/orgs/[orgSlug]` → `app/t/[tenantSlug]`.
  - Add a 301 redirect `/orgs/:slug/:path*` → `/t/:slug/:path*`, in the same place the app's other redirects live (`rg "redirects" apps/merchant`).
  - `ORG_ROUTES` → `TENANT_ROUTES`, `useOrganizationPath` → `useTenantPath`, and so on.
  - UI copy is **not** changed.
  - Mobile: rename any contract usage only.
- **Tests:** existing tests are renamed, plus a redirect test in `apps/merchant/__tests__/`.

**MT-08: Rename docs and the word check**

- **Do:**
  - Update `docs/`, `rules/`, `README.md`, `GLOSSARY.md` and `AGENTS.md`, with "tenant" everywhere except UI-copy references.
  - Run the §5 exit check, and list every remaining hit (UI copy only) in the PR.
  - Add an ESLint `no-restricted-syntax` rule banning identifiers matching `/[Oo]rgani[sz]ation/` in `apps/api/src` and `packages/{shared,messaging,client}/src`. String literals are allowed, for UI copy. This is a new rule, so **report it to the human before merging it** (AGENTS.md: rule changes need a human).

**MT-09: P1 gate**

- **Do:**
  - Recreate the dev DB from the new baseline (`pnpm db:reset` plus seed, on the **dev** DB this one time, as the human approved in D14), then run `pnpm tools db:carry-github-link import`.
  - Verify that the superadmin's GitHub link exists and that `GET /github/account` returns the linked login (shown masked).
- **Gate:** G +e2e +ci, all green. **P1 is not done until the GitHub link check passes.**

### P2 — Tenancy core (D6, D8, D12, D23, D25, D26)

**MT-20: `TenancyMode`**

- **Do:**
  - In `api-env.rules.ts`, parse `TENANCY_ENABLED` with the existing `BooleanFlagEnvSchema` and transform it to `TenancyModeSchema = z.enum(["single", "multi"])`, exported from `packages/shared` (`contexts/tenancy/schemas/tenancy-mode.ts`).
  - Require `DEFAULT_TENANT_ID` when the mode is single. Reject it at boot when it is set in multi mode, with a clear message, so a stray fallback cannot exist.
  - `TenancyConfigService` exposes `mode: TenancyMode` and `defaultTenantId(): TenantId` (single only). Delete `enabled`, `staffBypassesRls` and `singleTenantOrganizationId`.
- **Tests:** env-rules specs for both modes, both errors and a missing default.
- **Gate:** G.

**MT-21: Tenant sources at the composition root**

- **Do:**
  - Add the `TenantSource` port in `platform/application/tenancy/tenant-source.port.ts`: `resolve(request): Promise<TenantResolution>`.
  - `TenantResolution` is a zod-discriminated `{ kind: "tenant"; tenantId; lifecycleState } | { kind: "none" }`.
  - Add two implementations in `platform/infrastructure/tenancy/`:
    - `FixedTenantSource` returns the default tenant. A `:tenantSlug` that does not resolve to the default tenant returns 404.
    - `RouteTenantSource` looks up the slug, including slug history, through `auth.membership.lookup`.
  - Bind them in the tenancy module by mode. This is the only place the mode is read.
  - Add an architecture test (`apps/api/src/__tests__/tenancy-mode-boundary.spec.ts`) that greps the sources for `TENANCY_ENABLED`, `TenancyMode` and `.mode` outside the allowed folders.
- **Tests:** unit specs for both sources.

**MT-22: Resolver rewrite and header removal (D6)**

- **Do:**
  - Rewrite `authorization-context.resolver.ts`: the tenant comes from `TenantSource` for user principals and from the credential for machine principals.
  - Delete the reads of `x-organization-id` (resolver and `authorization.guard.ts`), `params.organizationId/orgId` and query or body ids.
  - A machine principal whose request has `params.tenantSlug`, or a `tenantId` anywhere, gets 400 `TENANT_SELECTOR_NOT_ALLOWED`. (Since §11.10 the `x-tenant-id` header is information only and is not refused.)
  - Delete `boundOrganizationId`.
- **Tests:** resolver specs for each source, the machine rejection and the absence of the header (sending it changes nothing).

**MT-23: Lifecycle check (D25, C1)**

- **Do:**
  - Add the `@TenantLifecycleRoute()` decorator.
  - Add `TenantLifecycleGuard`, which runs after tenant resolution on every tenant route and applies C1.
  - Mark exactly these routes: the tenant status read, the existing reactivation, appeal and KYB-resubmission endpoints (`rg -i "reactivat|appeal|resubmit" apps/api/src/contexts/tenancy/presentation`), and "leave tenant".
  - **If any of them does not exist, stop and report.**
  - Add new error codes `TENANT_SUSPENDED` and `MEMBERSHIP_INACTIVE` to the shared error-code catalogue, with web and merchant messages.
- **Tests:** guard specs for each state × route kind.

**MT-24: Strict tenant ids in contracts (D23)**

- **Do:**
  - Every request schema in `packages/shared` used by a tenant, machine or customer route is `.strict()`, and none declares `tenantId`.
  - Add a contract test that walks the registered request schemas and asserts that `tenantId` makes them fail with 400 through the existing validation pipe.
  - Cross-tenant lookups already return 404 through RLS. Add assertions for that in MT-26.
- **Tests:** the contract test plus pipe specs.

**MT-25: Two-tenant fixture (D26)**

- **Do:** build §8.1 exactly. Add the `seed.test_fixture` operation, and make the fixture idempotent (upsert by fixed id).
- **Tests:** `test/support/__tests__/two-tenant-fixture.e2e-spec.ts` seeds twice and asserts every row and column.

**MT-26: P2 test suites**

- **Do:**
  - Add the `test:e2e:tenancy` and `test:e2e:tenancy:single` scripts. Each uses `vitest.config.e2e.ts` with an env override, through the existing e2e env loader, not a second config.
  - Implement ST-001…005, MT-001…005, MT-007 (application half), LOC-_, CU-_, LIFE-* and MACH-*.
- **Gate:** G +e2e +ci.

### P3 — Transaction-local context (D22)

**MT-30: Remove the session stamp**

- **Do:**
  - `rls-pool.ts` stops calling `set_config(…, false)` at checkout. A checked-out connection carries **no** RLS settings.
  - `tenant-transaction.service.ts` becomes the only way to run tenant or user-scoped SQL. It does BEGIN, then `set_config` for each setting with `true`, then the work, then COMMIT or ROLLBACK.
  - Rename the setting to `app.current_tenant_id` (done in P1).
- **Tests:** unit specs for the stamping order.

**MT-31: Reads run in transactions**

- **Do:**
  - `PrismaReadExecutor` and every read session run their queries through the transaction service. Use a read-only transaction (`SET TRANSACTION READ ONLY`) when the read has no writes.
  - Every repository read must go through it. A lint-style architecture test asserts that no file under `contexts/*/infrastructure` calls the bare `PrismaService` client outside a transaction callback (`rg "this.prisma\." contexts`).
- **Tests:** repository specs.

**MT-32: DB-005**

- **Do:** implement DB-005, plus a test that a request with no tenant leaves no setting behind on its connection.
- **Gate:** G +e2e +ci.

### P4 — Bypass removal and narrowing (D3, D4, D19, D20, D21, D28)

**MT-40: Remove the single-mode staff bypass (D3)**

- **Do:** delete `staff_single_tenant` from `UserAccessScope`, `STAFF_SINGLE_TENANT_OPERATION`, the registry entry and every reference. Staff in single mode resolve like any user of the default tenant.
- **Tests:** ST-005.

**MT-41: Superadmin is no longer a tenant superuser (D4)**

- **Do:**
  - Delete `"superadmin"` from `UserAccessScope` and the `platform.superadmin` operation.
  - On a tenant route, platform staff are ordinary users. If they have no membership, `SupportAccessGrantLocator` must return an approved, unexpired grant for that tenant, or the request gets 403.
  - With a grant, the RLS context is the tenant's, and the audit entry records `supportAccessGrantId`.
- **Tests:** PLAT-002 and PLAT-003.

**MT-42: Narrow the 60 operations**

- **Do:**
  - For each `NOT_YET_NARROWED` entry, read its call sites and replace the scope with `tables(...)`.
  - Commit one bounded context's operations per commit, so review stays small.
  - Regenerate the scopes.
- **Tests:** existing e2e tests exercise them. If a test fails with a permission error, the allowlist is missing a table. Add it only after reading the query.

**MT-43: Public operations replace `@RlsBypass` (D19)**

- **Do:**
  - For each of the 26 files using `@RlsBypass()`, give each handler a named `public.<flow>` operation with its exact tables, and swap the decorator for `@PublicOperation("<op>")`.
  - Replace `request.pre_handler` with the four `auth.*.lookup` operations (§6) in the guards.
  - Delete `route.rls_bypass`, `request.pre_handler`, `RlsBypass` and `RLS_BYPASS_KEY`.
- **Tests:** a unit test that every handler formerly marked `@RlsBypass` now carries `@PublicOperation`.

**MT-44: `@PlatformOperation` and coverage (D20)**

- **Do:**
  - Add the decorator, and have the interceptor set the named operation for the handler.
  - Annotate every admin-app endpoint. These are the routes whose permission is an admin capability; the list comes from `apps/admin/lib/navigation` page-API coverage.
  - Add `apps/api/src/__tests__/platform-operation-coverage.spec.ts`: it fails if a controller route requires an admin-console permission but has no `@PlatformOperation`, and also if a route has both decorators.
- **Tests:** the coverage spec plus PLAT-001.

**MT-45: Impersonation needs a grant (D21)**

- **Do:** `impersonation-start.policy.ts` requires an approved, unexpired `SupportAccessGrant` for every tenant in which the target holds a membership. Customers with no membership need none, because their data is user-owned. Record the grant id on `ImpersonationSession` and in the audit entry. If that needs a column, it goes through MT-03's procedure as a new generated migration (stop and report first, §0.2.5).
- **Tests:** PLAT-004 and policy unit specs.

**MT-46: Marketplace operation (D28)**

- **Do:** the customer reward browse and detail reads use `marketplace.published_rewards.read`. The query filters `published` and `isDeleted = false` itself, and selects only public fields.
- **Tests:** an e2e test that unpublished rewards of A and B never appear, and that no private column is returned.

**MT-47: Remove `allTables` (D19)**

- **Do:** delete the `allTables` kind and `AllTablesReason`, and type `tables` as `TableName[]`.
- **Tests:** the type-level test (§6).
- **Gate:** G +e2e +ci.

### P5 — FORCE RLS and seed operations (D9, D24, C3)

**MT-50: Classify `RewardSale` and the unannotated tables**

- **Do:**
  - Annotate `RewardSale` as tenant-owned. Add its tenant policy beside the API-key policies.
  - For the other unannotated tables (§2.4), add the annotation that matches their current policy. If a table has no policy at all, stop and report.

**MT-51: `FORCE ROW LEVEL SECURITY`**

- **Do:** in the RLS SQL applied by `db:apply-security` (the same files that `ENABLE` RLS), add `ALTER TABLE … FORCE ROW LEVEL SECURITY` for every table that has RLS enabled. This is RLS SQL, not a migration. It follows the existing `db:apply-security` flow.

**MT-52: Seed operations (D24)**

- **Do:** every seed module writes through a named `seed.<area>` operation that lists its tables, and `db:check-seed-coverage` still passes. Migrations stay schema-only.

**MT-53: Runtime-role proof (D9)**

- **Do:**
  - Add `platform/infrastructure/database/runtime-role-proof.ts`. At boot it checks that `app_runtime` has `rolsuper` and `rolbypassrls` both false and that `relforcerowsecurity` is true for every manifest table. If any check fails, boot fails with a message naming the table or role.
  - Wire it into readiness.
  - Run the same check in CI (DB-006).
  - Document separate migration and runtime logins in `docs/technical/database/` (runbook).
- **Tests:** DB-001…004, DB-006 and DB-007.
- **Gate:** G +e2e +ci.

### P6 — Integrity (D10, D31, C2)

**MT-60: Data check**

- **Do:** add `apps/api/scripts/db/check-tenant-integrity.ts` and its `db:check-tenant-integrity` script. Through `tenancy.data_check`, it counts the rows that violate each §7 row (a child row whose parent has a different `tenantId`). It prints a table and exits 1 if any count is non-zero. **Never fix data. Stop and report.**
- **Gate:** the script exits 0 on the dev DB copy and on the e2e DB.

**MT-61: Composite uniques**

- **Do:** add `@@unique([tenantId, id])` to `Location`, `Membership`, `Reward`, `Store` and `TenantApiKey`, then run `pnpm db:migrate:create --name tenant_composite_uniques` (generated).

**MT-62: Composite FKs**

- **Do:** change each of the 16 relations in §7 to `fields: [tenantId, <fk>], references: [tenantId, id]` with the listed `onDelete`, then run `pnpm db:migrate:create --name tenant_composite_fks` (generated).
- **Tests:** MT-006 (the DB half), plus one e2e test per parent type that attempts a cross-tenant insert as `app_runtime` and expects a foreign-key violation.
- **Gate:** G +e2e +ci.

### P7 — CI matrix and docs (D2, D11, D13)

**MT-70: CI matrix**

- **Do:**
  - In `.github/workflows/ci.yml`, the `e2e` job sets `TENANCY_ENABLED=true` and runs the full suite plus `test:e2e:tenancy` and `test:e2e:rls`.
  - A new job, `e2e-single-tenant`, sets `TENANCY_ENABLED=false` and `DEFAULT_TENANT_ID` (the fixture's Tenant A), and runs `test:e2e:tenancy:single` and `test:e2e:rls`.
  - Mirror both in `ci:local` (its plan file and test).

**MT-71: Docs**

- **Do:**
  - Write ADR 062 (already drafted) and update the ADR index.
  - Update `docs/architecture/context-map.md`, `rules/08` and `rules/10` (tenant vocabulary and the no-bypass rule), and `prisma/rls/README.md` (FORCE RLS and settings).
  - Add the RLS coverage matrix (`docs/technical/database/rls-coverage.md`): one row per tenant table with RLS enabled, forced, read, insert, update, delete, and the test ID that proves each.
  - Write runbooks in `docs/technical/operations/`:
    - switching single ↔ multi
    - tenant onboarding
    - tenant suspension
    - separate DB credentials

**MT-72: `.env.example` (D2)**

- **Do:** `apps/api/.env.example` uses this exact block:

  ```dotenv
  # true  = multi-tenant (RewardHub's mode). Every tenant request resolves its tenant from /tenants/:tenantSlug
  #         (users) or from the credential (POS). No default-tenant fallback.
  # false = single-tenant. DEFAULT_TENANT_ID is the fixed tenant; clients cannot choose another. RLS still applies.
  TENANCY_ENABLED=true

  # Single-tenant mode only (TENANCY_ENABLED=false). Must name an existing, non-deleted tenant; verified at boot.
  # Setting it in multi mode fails boot.
  # DEFAULT_TENANT_ID=019b76da-a800-7a94-a198-23ad1b4cfdd9
  ```

- **Gate:** G +e2e +ci. **This is the final gate.** Fill in the §11 report.

---

## 10. Definition of done

- [x] No "organization" in code, data, env or docs (UI copy excepted). The ESLint identifier ban is in place (MT-08, approved by the human on 2026-10-20).
- [x] `TenancyMode` is parsed once, and the boundary test passes.
- [x] `.env.example` defaults to multi (MT-72).
- [x] The slug (users) and the credential (machines) are the only tenant sources. The header is gone.
- [x] Tenant ids in requests return 400, and cross-tenant resources return 404.
- [x] Multi mode never uses `DEFAULT_TENANT_ID` (MT-003). Single mode is fixed (ST-002).
- [x] Lifecycle is checked on every request, and the allowlist is decorator-marked.
- [x] `staffBypassesRls`, `platform.staff_single_tenant`, `platform.superadmin`, `route.rls_bypass`, `request.pre_handler` and `allTables` are all gone.
- [x] All operations are narrowed. `@PlatformOperation` has its coverage test, and impersonation needs a grant.
- [x] FORCE RLS is on every RLS table, and the runtime-role proof runs at boot and in CI.
- [x] The 16 composite FKs (§7) exist after a clean data check.
- [x] CI has full multi e2e, the single-mode suite and the RLS suite. The fixture is shared.
- [x] The ADR, runbooks and RLS coverage matrix are written.
- [x] The superadmin's GitHub link (MT-09). It could not be carried across the reset (it was already absent and no carry file existed), so the owner relinked it on 2026-10-20. Verified the same day: the superadmin's `GithubAccountLink` exists in the dev DB, and `GET /github/account` returns 200 with the linked login (shown masked).

## 11. Completion report (filled in at MT-72, 2026-10-20)

### 11.1 Summary

- **One codebase, two modes.** `TENANCY_ENABLED` picks the tenant source and nothing else: `RouteTenantSource` reads `:tenantSlug` (multi); `FixedTenantSource` pins `DEFAULT_TENANT_ID` (single). No service, policy, RLS policy, Cedar bundle or ReBAC check reads the mode; `tenancy-mode-boundary.spec.ts` fails the build if one starts to.
- **Resolution.** A tenant route resolves its tenant from the slug (multi) or the fixed tenant (single), then proves membership. A missing, unknown or foreign tenant answers 404, never 403, so tenant existence is not disclosed. Single mode has no fallback in multi mode: `DEFAULT_TENANT_ID` is ignored there and the e2e setup deletes it.
- **Authorization.** Superadmins are authorized like anyone else (the resolver shortcut is gone). Platform staff reach tenant data only through an approved, unexpired `SupportAccessGrant`; the grant id is written into the audit row and into each impersonation session (`supportAccessGrantIds`).
- **RLS.** The API connects as the owner and immediately `SET ROLE app_runtime` (no BYPASSRLS, not owner); every application table has RLS **and** FORCE. Context (`app.current_tenant_id`, `app.current_user_id`, `app.system_operation`) is transaction-local. Every system operation names its tables; `allTables` no longer exists. Routes carry either `@PlatformOperation` or `@PublicOperation`, never both, and discovery tests prove every route is classified.
- **Integrity.** 16 composite `(tenantId, id)` foreign keys make a cross-tenant reference impossible even for the table owner; `pnpm tools db:check-tenant-integrity` re-checks live data.

### 11.2 Files changed (by area)

| Area                                | Main files                                                                                                                                                    | Tests                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tenant source and request principal | `fixed-tenant.source.ts`, `route-tenant.source.ts`, `request-principal.ts`, `actor-context.factory.ts` (deleted `actor-tenancy.policy.ts`)                    | `tenant-source.spec.ts`, `rls.interceptor.spec.ts`, `tenancy-mode-boundary.spec.ts`, `test/tenancy/**`                             |
| Route operations                    | `public-operation.decorator.ts`, `rls.interceptor.ts`, every public controller                                                                                | `platform-operation-coverage.spec.ts` (PLAT-005), `public-operation-coverage.spec.ts` (MT-43), `test/support/controller-routes.ts` |
| System operations                   | `system-operation.registry.ts`, `prisma/rls/system-operation-scopes.ts`, generated `00-system-operation-scopes.sql`, `seed-demo-dataset.operation.ts`         | registry specs, `test/system-operations.e2e-spec.ts`                                                                               |
| RLS SQL                             | `prisma/rls.sql` (FORCE everywhere, geo writes), `01-acl-location-access.sql` (membership confined to the bound tenant), `90-analytics-consumer.sql`          | `test/rls/runtime-role.e2e-spec.ts` (DB-001…008)                                                                                   |
| Runtime role proof                  | `runtime-role-proof.ts`, `database-safety.module.ts` — the `tenant-isolation` readiness check                                                                 | `runtime-role-proof.spec.ts`                                                                                                       |
| Schema                              | `schema.prisma` — composite uniques and 16 composite FKs, `ImpersonationSession.supportAccessGrantIds`; baseline `20261021110415_init` (regenerated by the owner on 2026-10-21; `migrations-baseline.json` moved to it) plus `20261021114329_tenant_ban_and_customer_bans`                        | `composite-foreign-keys.e2e-spec.ts` (MT-006), `db:check-tenant-integrity`                                                         |
| Authorization                       | `authorization-context.resolver.ts`, `impersonation-start.policy.ts` and the impersonation aggregate/repository                                               | PLAT-002/003/004 unit and `test/tenancy/multi/platform-staff.e2e-spec.ts`                                                          |
| Merchant onboarding                 | `complete-merchant-onboarding.handler.ts`, `account-provisioning.port.ts/.service.ts` — atomic: no account and no email unless the whole onboarding commits   | `test/merchant-onboarding.e2e-spec.ts`                                                                                             |
| Admin KYB review                    | `tenant.merchant.admin_read` now scopes `StoredFile`                                                                                                          | `test/admin-merchant-kyb.e2e-spec.ts`                                                                                              |
| Integration API                     | `Integration{Rewards,Analytics,Redemptions}Controller` (`/integration/*`, API key only); `/tenants/:tenantSlug/*` serve members only                          | `merchant-location-scope.e2e-spec.ts` (MACH-002), `pos-terminals.e2e-spec.ts`, controller metadata specs                           |
| Seeds                               | `client.ts` (seeds run as `app_runtime` under `seed.demo_dataset`), `tenants.ts`, `rewards.ts`, `http-audit.ts`, `account-security.ts`, `analytics-ingest.ts` | `db:check-seed-coverage`                                                                                                           |
| CI                                  | `ci.yml` (multi e2e + new single-tenant job), `write-api-ci-env` action, `ci-local-plan.mjs`, `turbo.json`                                                    | `ci-workflow-env.spec.ts`, `ci-local-plan` test                                                                                    |
| Web                                 | merchant `use-tenant-slug.ts` (param fix), `legacy-tenant-redirects.ts` (`/orgs/*` → `/t/*`)                                                                  | their `__tests__`                                                                                                                  |
| Docs                                | ADR 062 notes, `rls-coverage.md`, four operations runbooks, `rules/08`, `rules/10`, `GLOSSARY.md`, API reference (regenerated from 219 live samples)          | `@workspace/docs` tests                                                                                                            |

### 11.3 Env behaviour (§4.2)

| Request kind                     | Single                                  | Multi                      | Proven by                                              |
| -------------------------------- | --------------------------------------- | -------------------------- | ------------------------------------------------------ |
| Tenant route (user)              | fixed tenant; another slug is not found | `:tenantSlug` + membership | ST-001…005; `test/tenancy/multi/isolation.e2e-spec.ts` |
| Customer route                   | no tenant, user-owned context           | same                       | CU-003                                                 |
| Machine route (POS)              | the key's tenant                        | same                       | MACH-002                                               |
| Platform route (admin app)       | `@PlatformOperation`, no tenant         | same                       | PLAT-005; live check below                             |
| Marketplace read                 | `marketplace.published_rewards.read`    | same                       | `test/tenancy/multi/isolation.e2e-spec.ts`             |
| Public pre-auth                  | its own `@PublicOperation`              | same                       | MT-43 coverage spec                                    |
| Tenant route by a platform admin | only with an active grant, else 404     | same                       | PLAT-002, PLAT-003, PLAT-004                           |

A live run against a built API confirmed the role split the admin panel relies on: the platform superadmin signs in to the admin app and reads its seven data sources (200); merchant owners and cashiers are refused at the admin sign-in (401) and on platform routes (403); the superadmin is refused on a merchant's tenant route without a grant (404).

### 11.4 RLS

- `app_runtime` is not a superuser, has no BYPASSRLS and owns no table (DB-006, and the `RuntimeRoleProof` boot check); readiness reports `tenant-isolation: up, role app_runtime, 80 tables, 0 failures`.
- Forced tables: all 80 application tables (DB-006); FORCE binds the owner too (scratch-database test). Isolation under the role: no context sees nothing (DB-001), another tenant's rows are invisible (DB-002), cross-tenant insert and move are denied (DB-003, DB-004), aggregates stay in-tenant (DB-007), and a member of two tenants reaches only the routed one (DB-008).
- Bypasses removed: `allTables`, `NOT_YET_NARROWED`, `routeRlsBypass`, the superadmin resolver shortcut, `auth.account.provision`/`auth.account.rename`. The only all-table operation is `seed.demo_dataset`, used solely by `pnpm db:seed`.
- Transaction-local context and pooling: DB-005 (`tenant-transaction-session.e2e-spec.ts`) — after commit and after rollback the pooled connection carries no tenant and sees no tenant rows.

### 11.5 Verification

| Check             | Command                                 | Result                                                                                                     |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| format            | `pnpm run format`                       | pass                                                                                                       |
| lint              | `pnpm run lint`                         | pass (18/18 packages)                                                                                      |
| typecheck         | `pnpm run typecheck`                    | pass (18/18)                                                                                               |
| unit              | `pnpm run test`                         | pass (20/20 packages)                                                                                      |
| e2e (multi)       | `pnpm --filter @workspace/api test:e2e` | pass (565/565)                                                                                             |
| tenancy multi     | `… test:e2e:tenancy`                    | pass (37/37)                                                                                               |
| tenancy single    | `… test:e2e:tenancy:single`             | pass (5/5)                                                                                                 |
| RLS runtime role  | `… test:e2e:rls`                        | pass — multi 19/19, single 19/19                                                                           |
| data check        | `pnpm tools db:check-tenant-integrity`        | pass (16/16 relations, 0 cross-tenant rows)                                                                |
| migration history | `pnpm --filter @workspace/tooling test` | pass (338/338)                                                                                             |
| ci:local          | `pnpm run ci:local`                     | pass — 31/31 steps, exit 0, on 2026-10-20 after the review follow-up (§11.9), including the browser suites |

All e2e suites ran against a fresh throwaway database (`mt_e2e`), never the developer database.

### 11.6 Outstanding issues

| Severity | Component | Status (2026-10-21) |
| -------- | --------- | ------------------- |
| Medium   | Single mode, API keys | **Resolved** (§11.11): `ServedTenantPolicy` — a key of a tenant other than `DEFAULT_TENANT_ID` is not recognised (401) |
| Medium   | Single mode, provisioning | **Resolved** (§11.10): `TenantProvisioningGate` refuses invites in single mode |
| Low      | Single mode, membership list / marketplace | **Resolved** (§11.11): membership verification serves only the default tenant |
| Low      | Files upload | **Resolved** (§11.11): `POST /tenants/:tenantSlug/files/upload-url`; `POST /files/upload-url` takes no `tenantId` |
| Low      | Admin app | **Resolved** (§11.11): support-access console and user ban/unban |

### 11.7 Confirmation

- There is no multi-mode default-tenant fallback (`DEFAULT_TENANT_ID` is never read in multi mode; ST/MT suites).
- There is no staff or superadmin bypass on tenant data (PLAT-002/003/004; live check).
- All operations are narrowed (no `allTables`; `seed.demo_dataset` lists its tables explicitly and is seed-only).
- Both modes are tested, in CI (`e2e` multi and `e2e-single-tenant`) and above.

### 11.8 Deviations from the plan

- Public operations keep their domain names (e.g. `auth.login.verify`) instead of a `public.<flow>` prefix; `@PublicOperation` marks them.
- Refusals on tenant routes answer 404, not 403 (no tenant-existence disclosure).
- The legacy `/orgs/*` redirect is 308 (Next.js `permanent: true`), not 301; both are permanent and 308 keeps the method.
- Store and TenantTerminal needed extra composite uniques (`(tenantId, locationId)`, `(tenantId, apiKeyId)`) for Prisma's 1:1 relations.
- §7 listed six SetNull relations; there were seven. All became RESTRICT.
- 33 admin-console routes carry no `@PlatformOperation` (D20 asked for one on every admin route). Each touches no table beyond the caller's own user-owned rows — SSE relays, in-memory email previews, invite availability, the admin's own GitHub link — so it runs in the ordinary user scope, which never widens. They are listed, each with its reason, in `NO_SYSTEM_OPERATION_ROUTES` (`apps/api/src/__tests__/platform-operation-coverage.spec.ts`, PLAT-005); every other admin route must name its operation, and that spec fails if one does not.
- Seeding runs under one operation (`seed.demo_dataset`, every table listed explicitly) instead of one operation per module (P5). The seed is one ordered program whose modules write each other's tables (a reward needs its tenant, location and images in the same run); splitting the operation would only repeat the same table lists. It is seed-only and refused outside the seed command.
- MT-004 and CU-003 answer 404, not the plan's 403 (same rule as above: a non-member cannot tell that a tenant exists). MT-005 (a suspended membership) answers 403 `MEMBERSHIP_INACTIVE` as planned.

### 11.9 Review follow-up (2026-10-20)

A code review of the finished work raised ten issues; all are fixed, each with tests. One more surfaced while regenerating the API reference and is fixed too (last row).

| #   | Issue                                                                                                                                                                       | Fix                                                                                                                                                                        | Tests                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | A tenant reached through a store or location (no `:tenantSlug`) skipped the lifecycle check, so a suspended tenant was served                                               | Membership verification reports the targeted tenant (`TargetTenant`: id, lifecycle, the caller's real access status) however it was reached; the guard applies C1 to it    | `authorization.guard.spec.ts`, `tenant-membership.service.spec.ts`, `authorization-context.resolver.spec.ts`     |
| 2   | API-key access on `/tenants/:tenantSlug/{rewards,analytics,redemptions}` could never succeed (D6 refuses the slug)                                                          | Integration API `/integration/*` (all ten key-accessible operations); tenant routes are members-only; `/redemptions` (machine history) moved to `/integration/redemptions` | `merchant-location-scope.e2e-spec.ts`, `pos-terminals.e2e-spec.ts`, controller metadata specs, contract snapshot |
| 3   | Single-mode boot accepted a tenant whose lifecycle is `DELETED`, then 404ed every request                                                                                   | Boot reads through `TenantRouteLookup` and applies C1; `DefaultTenantRepository` removed                                                                                   | `default-tenant.service.spec.ts`, ST-003 (DELETED) in `fixed-tenant.e2e-spec.ts`                                 |
| 4   | The machine selector check missed `?tenantSlug=` and `body.tenantSlug`                                                                                                      | One selector schema checked the same way in path, query and body, plus `x-tenant-id`                                                                                       | `machine-tenant-selector.spec.ts`, MACH-002                                                                      |
| 5   | A route operation reached by an API key took the verified request tenant, not the key's                                                                                     | The interceptor uses `scopeTenantId` and `principalUserId`; inline `actingUserId` copies replaced by the shared helper                                                     | `rls.interceptor.spec.ts`                                                                                        |
| 6   | Operation names were declared in 2–4 places each                                                                                                                            | One named constant per name (34 names); the route and its adapters import it                                                                                               | `system-operation-single-source.spec.ts` (every name)                                                            |
| 7   | Single mode ran 1–2 tenant lookups per request for a tenant verified at boot                                                                                                | One route-key lookup, compared with `DEFAULT_TENANT_ID`                                                                                                                    | `tenant-source.spec.ts`                                                                                          |
| 8   | The outbox dispatcher opened a transaction per published row and logged every idle poll at info                                                                             | One mark per sweep; `outbox.publish` is a `routine` operation (debug-level audit line)                                                                                     | `outbox-dispatcher.spec.ts`, `tenant-transaction-session.e2e-spec.ts`                                            |
| 9   | `tenantIdForRouteKey` was dead and filtered lifecycle differently                                                                                                           | Deleted                                                                                                                                                                    | —                                                                                                                |
| 10  | The guard's lifecycle check hardcoded `membershipStatus: "ACTIVE"`, leaving dead branches                                                                                   | The real access status flows from verification into C1                                                                                                                     | `authorization.guard.spec.ts`                                                                                    |
| —   | Found while capturing the integration samples: key-authenticated writes required a browser `Origin` and `X-Mutation-Intent`, so no server-to-server integration could write | `MutationIntentGuard` exempts an `X-API-Key` request, as it already exempted Bearer (an explicit credential a cross-site page cannot attach)                               | `mutation-intent.guard.spec.ts`, `merchant-location-scope.e2e-spec.ts`                                           |

### 11.10 Owner decisions (2026-10-21)

The human made four calls after the review. Each is implemented and tested.

| Decision | What changed | Tests |
| --- | --- | --- |
| Every machine call lives under `/integration/*` | Till pairing `POST /pos/terminals/pair` → `POST /integration/terminals/pair`; `POST /redemptions/validate` and `/checkout` → `POST /integration/redemptions/validate` and `/checkout`. Contracts are `apiContract.integration.{pairTerminal, validateRedemption, checkoutRedemption}`; the old `apiContract.pos` / `.redemptions` groups are gone. | contract snapshot, POS controller metadata spec, `pos-checkout`, `pos-terminals`, `pos-terminals-race`, `rate-limit-policies` e2e, mobile till test |
| Single-tenant mode creates no tenant | `TenantProvisioningGate` (bound by mode in the tenancy infrastructure, so the mode boundary holds) refuses `POST /admin/invites` and `POST /admin/tenants/invites` with 403 `TENANT_PROVISIONING_DISABLED` before any token or row exists. `GET /admin/invites/availability` reports it; the admin panel hides **Merchants → Invites** (feature flag `merchant-invites`) and its page answers 404. | `tenant-provisioning.gate.spec`, `tenant-provisioning.handlers.spec`, admin feature-flag, availability and invite-page tests |
| `X-Tenant-Id` / `X-Location-Id` on every call, meaning to be decided later | The merchant console sends both from its open tenant and chosen store (no `X-Location-Id` for "All locations"); the till sends its pairing's tenant and store (the pairing answer now carries `tenant.id`). The API reads neither: `x-location-id` stopped being a location selector (it would otherwise have narrowed every merchant call to the chosen store), and a key's `x-tenant-id` is no longer refused — D6's refusal still covers a slug or `tenantId` in the path, query or body. CORS allows both. | resolver spec, machine-selector spec, `authorization-hardening` and `merchant-location-scope` e2e, CORS spec, api-client and merchant request-scope tests |
| Ban / unban stays for later | No change. | — |

A till paired before this change has no stored tenant or store id, so it reads as unpaired and must be paired again.

### 11.11 Gap closure (2026-10-21)

A cross-check of this plan and the DDD + CQRS plan listed what was still open; the owner asked for all of it (Swagger and Cedar at boot excepted, deferred). Each row is implemented and tested.

| Item | What changed | Tests |
| --- | --- | --- |
| MT-23 endpoints | The stop-and-report case of MT-23 (no reactivation, appeal or leave endpoint existed) was resolved by building them: `GET /tenants/:tenantSlug/lifecycle`, `POST …/appeals`, `POST …/reactivate` (owner, before the deletion grace ends), `POST …/members/leave` (any member but the owner); platform `GET /admin/merchants/:id/lifecycle`, `POST …/suspend`, `…/reinstate`, `…/appeals/:appealId/reject`. Lifecycle routes are `@TenantLifecycleRoute()`; leave is the `leave` kind. `TenantSuspensionAppeal` (one PENDING per tenant). Web and merchant show `TENANT_SUSPENDED` / `MEMBERSHIP_INACTIVE` in words; the merchant shell swaps in a lifecycle screen. | `tenant-lifecycle.aggregates.spec`, `tenant-lifecycle.handlers.spec`, lifecycle-route guard spec, admin and merchant component tests |
| Store → Location merge (D17) | `Store`, `StoreMembership`, the `STORE` scope/resource and `x-store-id` removed; location roles on `MembershipLocationScope.roleId`; `Location Manager` / `Location Staff` | kernel, resolver, guard, membership specs; `authorization-hardening`, `location-closure`, `composite-foreign-keys` e2e |
| Single-mode binding | `ServedTenantPolicy` (mode-bound in the tenancy infrastructure): membership and API-key verification only serve the default tenant | `served-tenant.policy.spec`, verifier spec, `served-tenant-http.e2e-spec` (single suite) |
| Tenant file uploads (D23) | `POST /tenants/:tenantSlug/files/upload-url`; the platform route refuses tenant categories and any `tenantId` | `upload-asset-type.test`, files controller/handler specs, `tenant-store-logo.e2e-spec` |
| Support access | Expiry job (`maintenance.support_access_expiry`, every 5 min); platform list + request/revoke console (`/users/support-access`); owner approvals card in merchant settings | `support-access.handlers.spec`, console and card tests |
| Ban / unban | SuperAdmin-only, audited; sessions revoked; admin user page panel; seeded banned customer | aggregate and handler specs, `user-ban-panel.test` |
| HTTP tenancy tests | MT-004 / MT-005 / MT-006 (application) over HTTP; ST-002's 400 for a body or query `tenantId` | `membership-http.e2e-spec` (multi), `served-tenant-http.e2e-spec` (single) |
| Regressions | One-transaction proof (tenant, invite email record and outbox share `xmin`); idempotent invite and sample-category retries; cross-tenant file completion refused | `tenancy-transaction-regressions.e2e-spec`, `tenant-store-logo.e2e-spec` |
| Naming | `Org*` short names in the merchant app renamed (`guardTenantPage`, `TenantBootstrap`, `lib/tenant/`, `MerchantTenantResponse`, …); API reference paths `/tenants/{tenantSlug}` | merchant suite, docs generator tests |

### 11.12 Owner requests (2026-10-21, second round)

| Item | What changed | Tests |
| --- | --- | --- |
| Merchant ban | New lifecycle state `BANNED` (migration `…_tenant_ban_and_customer_bans`). A super admin bans an `ACTIVE`, `RESTRICTED` or `SUSPENDED` tenant (`POST /admin/merchants/:id/ban`, `@SuperAdminOnly()`, op `tenant.lifecycle.admin_ban`) and lifts it (`…/unban` → `ACTIVE`). A pending appeal is closed in the same transaction. Ordinary routes answer 403 `TENANT_BANNED`; lifecycle routes stay open, but appeal and reactivate are refused by the aggregate. Members are **not** signed out: the next request is refused anyway, and a platform-wide sign-out would also lock them out of their other merchants and their customer account. | aggregate, policy, handler, guard specs; `tenant-and-customer-bans.e2e-spec`; admin panel and merchant screen tests |
| Rewards of a merchant that does not operate | The marketplace and the reward page list only rewards of an `ACTIVE` tenant (`TENANT_OPERATING_LIFECYCLE_STATE`); a claim on another merchant's reward answers 404 `REWARD_NOT_FOUND` (before, a suspended merchant's rewards stayed claimable). | `resource-list-translators` spec, claims handler spec, e2e |
| Customer ban by a merchant | `TenantCustomerBan` (tenant RLS; one active ban per tenant and customer, partial unique index; a lift keeps the row). Made from one of the tenant's redemptions at the caller's stores (`merchant:manage_rewards`), because merchants never see who a customer is; listed by that redemption's reward and time. Claims refuse 403 `CLAIM_CUSTOMER_BANNED`; tills report `CUSTOMER_BANNED` on validate and refuse it at checkout (403); the redemption log flags the customer. Pos supplies the redemption lookup through `REDEMPTION_CUSTOMER_FACTORY` (tenants never imports pos). | `customer-bans.handlers.spec`, claims and pos specs, read-repository spec, e2e, merchant page and log tests |
| Admin GitHub token | **Account → GitHub token** in the admin panel (`/account/github`), the same `GET`/`PUT`/`DELETE /github/account` the phone uses; the required permissions and GitHub's token URL moved to `@workspace/shared`. | `github-token-panel.test`, navigation coverage tests |

## 12. Risks and follow-ups

- **Store / StoreMembership merge** (D17): done 2026-10-21 (§11.11).
- **Read-transaction overhead** (MT-31): every read becomes BEGIN, then the query, then COMMIT. Measure the p95 on the N+1 list e2e tests before and after, and record it in `rules/19`.
- **The baseline reset** (D14) is valid only while no shared or deployed database exists. Once one does, any further rename must use expand/contract.
- **The ESLint identifier ban** (MT-08) landed with the human's approval. It applies to every TypeScript file through the shared `restricted-syntax-rules.js` (stricter than the four directories MT-08 named, with no hits outside them). The §5 exit check's remaining matches are all deliberate: the rule's own message and tests, the boot guard that rejects the retired `DEFAULT_ORGANIZATION_ID`, the HTML `autoComplete="organization"` token in `packages/client/src/lib/contexts/tenancy/kyb/fields.tsx`, links to historical ADR file names, and this plan's own rename tables.
