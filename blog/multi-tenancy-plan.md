---
title: "Multi-tenancy plan"
description: "The approved decisions and ordered tasks for making RewardHub multi-tenant while the same codebase keeps a single-tenant mode."
author: "Acme Inc."
date: 1786924800000
category: "Architecture"
---

# Multi-Tenancy Plan

> **Status:** approved for implementation (2026-10-20). Decisions D1–D31 came out of a design review and are binding.
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
| Q5      | API routes move from `/orgs/:orgSlug/…` to `/tenants/:tenantSlug/…`. Merchant URLs move from `/orgs/[orgSlug]` to `/t/[tenantSlug]`, with old URLs redirected (301). On-screen copy keeps "Store" and "Business". The word "organization" is banned in code, data, env and docs, **not** in UI text.                                                                         |
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
- The scripts are `db:migrate:create`, `db:generate`, `db:seed`, `db:rls`, `db:apply-security`, `db:check-rls-manifest`, `db:check-seed-coverage`, `db:check-drift` and `db:generate-system-operation-scopes`.
- CI is `.github/workflows/ci.yml`. Its `e2e` job runs `pnpm --filter @workspace/api test:e2e`, and no CI job sets `TENANCY_ENABLED`, so every test today runs single-tenant.

### 2.3 Size of the rename

About 9,700 case-insensitive occurrences of "organization" across about 1,100 files in `apps/`, `packages/`, `docs/` and `rules/`. That includes:

- 15 `Organization*` models and 116 `organizationId` columns
- 43 API controllers under `orgs/:orgSlug`
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
    U->>DB: BEGIN; set_config('app.current_tenant_id', tenantId, true); queries; COMMIT
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
| API `/orgs/:orgSlug/…`                                                                                                                                 | `/tenants/:tenantSlug/…`                                                                |
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
  1. Run `pnpm db:carry-github-link export` against the dev DB. **Do not proceed** until the file exists.
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
  - Controllers move from `apiPath("/orgs/:orgSlug/…")` to `apiPath("/tenants/:tenantSlug/…")`, and route params from `orgSlug` to `tenantSlug`.
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
  - Recreate the dev DB from the new baseline (`pnpm db:reset` plus seed, on the **dev** DB this one time, as the human approved in D14), then run `pnpm db:carry-github-link import`.
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
  - A machine principal whose request has `params.tenantSlug`, or a `tenantId` anywhere, gets 400 `TENANT_SELECTOR_NOT_ALLOWED`.
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

- **Do:** in the RLS SQL applied by `db:rls` (the same files that `ENABLE` RLS), add `ALTER TABLE … FORCE ROW LEVEL SECURITY` for every table that has RLS enabled. This is RLS SQL, not a migration. It follows the existing `db:apply-security` flow.

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

- [ ] No "organization" in code, data, env or docs (UI copy excepted). The ESLint rule has been proposed to the human.
- [ ] `TenancyMode` is parsed once, and the boundary test passes.
- [ ] `.env.example` defaults to multi (MT-72).
- [ ] The slug (users) and the credential (machines) are the only tenant sources. The header is gone.
- [ ] Tenant ids in requests return 400, and cross-tenant resources return 404.
- [ ] Multi mode never uses `DEFAULT_TENANT_ID` (MT-003). Single mode is fixed (ST-002).
- [ ] Lifecycle is checked on every request, and the allowlist is decorator-marked.
- [ ] `staffBypassesRls`, `platform.staff_single_tenant`, `platform.superadmin`, `route.rls_bypass`, `request.pre_handler` and `allTables` are all gone.
- [ ] All operations are narrowed. `@PlatformOperation` has its coverage test, and impersonation needs a grant.
- [ ] FORCE RLS is on every RLS table, and the runtime-role proof runs at boot and in CI.
- [ ] The 16 composite FKs (§7) exist after a clean data check.
- [ ] CI has full multi e2e, the single-mode suite and the RLS suite. The fixture is shared.
- [ ] The ADR, runbooks and RLS coverage matrix are written.
- [ ] The superadmin's GitHub link survived the reset (MT-09).

## 11. Completion report (fill in at MT-72)

1. **Summary:** single and multi behaviour, resolution, authorization and RLS.
2. **Files changed:** path, purpose and tests.
3. **Env behaviour:** each row of §4.2 with the test ID that proves it.
4. **RLS:** the `app_runtime` attributes, the forced tables, the bypasses removed, transaction-local context verified, and pooling tested.
5. **Verification:** fill in this table.

   | Check             | Command                                 | Result |
   | ----------------- | --------------------------------------- | ------ |
   | format            | `pnpm run format`                       |        |
   | lint              | `pnpm run lint`                         |        |
   | typecheck         | `pnpm run typecheck`                    |        |
   | unit              | `pnpm run test`                         |        |
   | e2e (multi)       | `pnpm --filter @workspace/api test:e2e` |        |
   | tenancy multi     | `… test:e2e:tenancy`                    |        |
   | tenancy single    | `… test:e2e:tenancy:single`             |        |
   | RLS runtime role  | `… test:e2e:rls`                        |        |
   | data check        | `pnpm db:check-tenant-integrity`        |        |
   | migration history | `pnpm --filter @workspace/tooling test` |        |
   | ci:local          | `pnpm run ci:local`                     |        |

6. **Outstanding issues:** severity, component, consequence and next action.
7. **Confirmation:**
   - There is no multi-mode default-tenant fallback.
   - There is no staff or superadmin bypass on tenant data.
   - All operations are narrowed.
   - Both modes are tested.
8. **Checks not run, and why.** Anything not run is **NOT VERIFIED**.

Do not mark the work complete while any tenant-isolation test fails.

## 12. Risks and follow-ups

- **Store / StoreMembership merge** (D17): merge them into Location + MembershipLocationScope. This is a separate domain redesign.
- **Read-transaction overhead** (MT-31): every read becomes BEGIN, then the query, then COMMIT. Measure the p95 on the N+1 list e2e tests before and after, and record it in `rules/19`.
- **The baseline reset** (D14) is valid only while no shared or deployed database exists. Once one does, any further rename must use expand/contract.
- **The ESLint identifier ban** (MT-08) needs human approval before it lands.
