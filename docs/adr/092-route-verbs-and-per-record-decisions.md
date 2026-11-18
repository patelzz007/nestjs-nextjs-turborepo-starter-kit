---
title: "ADR 092: One Verb per Route, Per-Record Decisions, and the Guard Rails Around Them"
tags: ["adr", "authorization", "rls", "security", "frontend"]
description: "Every merchant route checks the catalogue verb of what it does (read, create, update, delete, publish); reward edits and publishing are decided per record; the database follows the same verbs, and tests keep the routes, the policies and the types in step."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/adr/092-route-verbs-and-per-record-decisions.webp"
order: 92
---

# ADR 092: One Verb per Route, Per-Record Decisions, and the Guard Rails Around Them

## Status

Accepted and built (2026-11-18). Builds on [ADR 067](./067-unified-authorization-model.md),
[ADR 089](./089-generated-security-sql.md), [ADR 090](./090-permission-level-tenant-rls.md) and
[ADR 091](./091-casl-frontend-ability.md).

## Context

After ADR 090 the database checked a permission on every tenant table, but many routes still checked an odd verb: the
till and key lists checked `api_key.create`, payment reads `payment.create`, the team list `member.update`, every
webhook action `webhook.update`, the banned-customer list `reward.update`. The database had to accept both verbs, so a
role editor's choices did not mean what they said ("can create keys" also meant "can see them"), and reward create was
gated on `reward.update` while the database needed `reward.create`.

Reward edits were decided at tenant level only, so a share of one reward (ADR 067's SHARE path) was never honoured.

## Decision

### Each route checks the verb of what it does

The merchant capability list (`@workspace/shared` `MerchantCapabilitySchema`) gains one capability per catalogue verb a
route needs. Each maps to exactly one permission (`MERCHANT_CAPABILITY_PERMISSION`):

| Area | Read | Write |
|---|---|---|
| Rewards | `view_rewards` (reward.read) | `create_rewards` (create), `manage_rewards` (update), `publish_rewards` (publish) |
| Banned customers | `view_customer_bans` | `ban_customers` (create), `lift_customer_bans` (delete) |
| API keys | `view_api_keys` (also the till settings) | `manage_api_keys` (create; till settings), `revoke_api_keys` (delete) |
| Tills | `view_terminals` | `manage_terminals` (create: register, pairing code), `remove_terminals` (delete) |
| Team | `view_team` (roster, invitations) | `manage_team` (update), `invite_members`, `revoke_invites`, `approve_access_requests`, `reject_access_requests` |
| Verification | `view_verification` (kyb.read) | `manage_verification` (kyb.update) |
| Payments | `view_payments` | `manage_payments` (create), `refund_payments` (update) |
| Webhooks | `view_webhooks` | `create_webhooks`, `manage_webhooks` (update), `delete_webhooks` |
| Broadcasts | `view_broadcasts` (also the audience preview, customer picker and allowance) | `create_broadcasts`, `manage_broadcasts` (update), `publish_broadcasts` |

The Owner and Manager templates already hold every one of these verbs, so seeded roles keep what they had. A custom
role now gets exactly what its permissions say.

### The database follows the same verbs, and writers read back what they write

Each tenant table's policies name the verb of each command. PostgreSQL makes a writer *see* the rows it writes
(`INSERT … RETURNING`, `UPDATE … WHERE`), so each write permission also has a read policy on the rows it writes. For
example, `api_key.create` reads the keys and `terminal.delete` reads the tills. Policies that existed only because a read
route checked a write verb are gone. Hard-DELETE policies with no route behind them (`reward.delete`, the reward
audience) are gone, and image and store-scope writes are narrowed to INSERT and UPDATE.

A member's own membership is renamed through the `tenant.membership.rename_own` system operation, so **no member holds
UPDATE on Membership**: the database cannot be asked to change one's own role or status.

A tenant's files follow the feature that uses them, not mere membership:

| Category | Read | Write |
|---|---|---|
| Logo, banner | every member | location.update |
| KYB documents | kyb.read or kyb.update | kyb.update |
| Reward images | reward.read or a reward writer | reward.create or reward.update |
| Broadcast images | broadcast.read or broadcast.update | broadcast.update |
| Anything else with a tenant | system operations only | system operations only |

### Reward edits and publishing are decided per record

`MerchantAccessRequest` takes an optional `target` (the record). With it, the access-control decision also honours a
share of that record and its ownership. The reward read, edit, minimum-tier and publish routes pass the reward.
Changing a reward's audience or images still needs `reward.update` itself: those write tenant data (the customer list,
the tenant's files) that a share does not reach.

`GET /tenants/:slug/rewards/:rewardId` answers `viewerCapabilities: { update, publish }`, decided the same way per
record through `MerchantCapabilityQueryPort.holds` (not audited; a hint, never an authorization). The reward page uses
it for "Submit for review" and the minimum tier. The full editor still needs `merchant:manage_rewards`.

### The frontend

| Change | What it does |
|---|---|
| Page and action gates | Use the new capabilities and the matching CASL verbs (`<Can I="READ" a="TERMINAL">`). Each action button checks its own verb. |
| No provider mounted | `<Can>` and `useAbility()` deny everything instead of throwing. |
| A 403 for a capability reason | `PERMISSION_DENIED` or `TENANT_ROLE_CAPABILITY_REQUIRED` makes each app re-read the session's capabilities. Actions the member lost disappear. |
| Where the ability is built | `@workspace/shared` keeps only the rules (`abilityRules`). The `Ability` itself is built in each app's provider, so the shared package never loads CASL at runtime. |

### Guard rails

| Guard | What it catches |
|---|---|
| `prisma/security/capability-access.ts` + `capability-access.spec.ts` | Declares what each capability's routes do to which tables as the member. The test fails if a route's verb is not admitted by its table's policy, or if a permission policy is used by no route. |
| `MEMBERSHIP_WRITE_RULES` test | A tenant table writable by every member regardless of role needs a listed reason. |
| `@map` test | The typed declarations assume model = table, field = column. |
| `sql-references.spec.ts` | Every table and column named in the hand-written function bodies, one-off rules and triggers exists in the schema. |
| `db:apply-security` in production | Fails rather than drop a policy `table-policies.ts` no longer declares, unless run with `--allow-policy-drops`. Development still drops them. |
| Pre-commit | Runs `db:check-security` when a commit touches anything the security SQL is generated from. |
| `db:security-explain <Table>` | Prints who may read and write a table, in plain words. |
| `RULE` catalogue | Gives every reusable rule a hover description in the editor. |

## Consequences

- A role editor's choices now mean what they say. A custom role that held only a write verb loses the matching read
  *route* (the database still lets it read back what it writes).
- More policies per table (the read-back ones), each named and explained by `db:security-explain`.
- The routes, the policies and the capability-to-table declaration must change together; the drift test enforces it.
