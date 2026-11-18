---
title: "Adding a Table: Row-Level Security Without Writing SQL"
tags: ["database", "rls", "security", "how-to"]
description: "The steps to protect a new table, the commands, and every policy rule in plain words: pick rules in TypeScript, generate the SQL, apply it."
author: "Platform Team"
category: "Database"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/technical/database/adding-a-table.webp"
order: 3
---

# Adding a Table: Row-Level Security Without Writing SQL

Every table is protected by PostgreSQL row-level security (RLS). You never write that SQL: you say **who may touch the
table** in TypeScript, and a generator writes the SQL (ADR 089). `apps/api/prisma/rls/*.sql` is generated — never edit it.

## The steps

| Step | What you do | File |
|---|---|---|
| 1 | Add the model (it extends `BaseModel`) | `apps/api/prisma/schema.prisma` |
| 2 | Create the migration | `pnpm db:migrate:create --name <change>` |
| 3 | List the table and pick its rules (below) | `apps/api/prisma/security/table-policies.ts` |
| 4 | Put it in a manifest profile | `apps/api/prisma/security/manifest-index.ts` |
| 5 | Give the roles that need it the permission (tenant data) | the role seed / Owner, Manager, Cashier templates |
| 6 | Protect the route with the verb of what it does (read, create, update, delete, publish — ADR 092) | `@RequirePermission(...)`, or a merchant capability |
| 7 | Say which tables the capability's routes touch as the member | `apps/api/prisma/security/capability-access.ts` |
| 8 | Generate and apply | `pnpm --filter @workspace/api db:security` |
| 9 | Commit the TypeScript **and** the regenerated `prisma/rls/*.sql` (the pre-commit hook checks it) | |

Forget step 3 and `pnpm typecheck` fails, naming the table. Forget step 7 and `capability-access.spec.ts` fails: either a
route's verb has no policy, or a policy has no route. Forget step 8 and the pre-commit hook and CI fail: the committed
SQL is stale.

To see what a table allows, in plain words: `pnpm --filter @workspace/api db:security-explain <Table>`.

**Your editor does the remembering.** Every declaration is type-checked against the real schema, so you can type
`rule: "` and pick from the list, and the same goes for each field after it:

| Field | Autocompletes from | A typo is |
|---|---|---|
| The table key | Every Prisma model (`Prisma.ModelName`); every model must be listed | A compile error |
| `rule` | The reusable rules, plus the one-off rules **of this table only** | A compile error |
| `column`, `storeColumn` | That table's own columns | A compile error |
| `resource`, `action` | The permission catalogue (`@workspace/shared`) | A compile error |
| `operations` | The system-operation registry | A compile error |
| `to` | The roles in `roles.ts` | A compile error |

Each rule also demands exactly its inputs: `ownerOrSystem` without a `column`, or `roleRead` without `to`, does not
compile. To read what a rule allows while you type, use the documented catalogue: `rule: RULE.ownerOrSystem`
(`prisma/security/rule-catalogue.ts`) is the same as `rule: "ownerOrSystem"`, and hovering it shows the description. The same holds for `roles.ts` (a column grant accepts only that table's columns), `triggers.ts` and
`withheld-privileges.ts`. The generator re-checks every value at runtime before it reaches SQL.

## An entry

```ts
// apps/api/prisma/security/table-policies.ts
Invoice: [
  { name: "invoice_read", rule: "permissionRead", resource: "PAYMENT", action: "READ", column: "tenantId" },
  { name: "invoice_write", rule: "system" },
],
```

A table's policies are permissive: a row is reachable when **any** of them admits it. An empty list (`Invoice: []`)
means nobody but the table owner may touch it.

**"People read, only the system writes" is always two policies**, as above: a read rule (a `SELECT` policy) and
`system` for the writes. Never one policy whose read condition is wider than its write check: PostgreSQL applies a
policy's `WITH CHECK` to inserts and to an update's new row, but a `DELETE` (and the rows an `UPDATE` picks) is
checked against `USING` alone, so everyone who may read the row could delete it. The generator refuses such a
policy (`assertDeleteMatchesWrite`), and the cross-tenant isolation e2e
(`apps/api/e2e/rls/cross-tenant-isolation.e2e-spec.ts`) checks every table for a delete or update across tenants.

## The rules

"System" below always means: a named system operation whose registry scope
(`src/prisma/system-operation.registry.ts`) lists this table.

| Rule | Needs | Allows |
|---|---|---|
| `system` | — | System operations only: read and write |
| `systemRead` / `systemInsert` / `systemUpdate` / `systemDelete` | — | System operations only: that one command |
| `systemOperationWrite` | `operations` | Only the named system operations, read and write |
| `ownerOrSystem` | `column` | The row's owner (`column` = the signed-in user), or system |
| `systemOrOwner` | `column` | The same, written system-first |
| `ownerOrSystemRead` / `ownerOrSystemInsert` / `ownerOrSystemUpdate` | `column` | The owner or system: read only / insert only / update only |
| `ownerReadSystemWrite` | `column` | The owner reads; only system writes |
| `ownerRead` | `column` | The owner reads; nothing else |
| `tenantMemberOrSystem` | `column` | Any active member of the row's tenant, or system |
| `tenantMemberReadOrSystem` | `column` | Members read; system |
| `systemOrTenantMember` | `column` | The same as `tenantMemberOrSystem`, written system-first |
| `systemOrActiveTenantMember` | `column` | Members of the tenant the session is bound to (a tenant route), or system |
| `systemOrActiveTenantMemberRead` | `column` | The same, read only |
| `systemOrStoreAccess` | `column`, `storeColumn` | System, or a member of the bound tenant who works at the row's store |
| `systemOrOptionalStoreAccess` | `column`, `storeColumn` | System, or a member; when the row names a store, one who works there |
| `permission` | `column`, `resource`, `action` | Role or live grant with `resource.action` in the tenant (ADR 067), or system |
| `permissionRead` / `permissionInsert` / `permissionUpdate` / `permissionDelete` | same | The same, for one command. Add `storeColumn` to check the row's store too |
| `apiKeyRead` / `apiKeyInsert` / `apiKeyUpdate` | `column` | A merchant API key of the row's tenant |
| `apiKeyNullableTenantRead` / `apiKeyNullableTenantInsert` | `column` | The same, for a row whose tenant may be empty |
| `apiKeyStoreRead` / `apiKeyStoreInsert` / `apiKeyStoreUpdate` | `column`, `storeColumn` | An API key of the tenant; a store-scoped key only its store's rows |
| `apiKeyRewardRead` / `apiKeyRewardInsert` / `apiKeyRewardUpdate` | `column` (reward id) | An API key of the reward's tenant |
| `apiKeySignupRefereeRead` / `apiKeySignupRefereeUpdate` | `column` | An API key that just redeemed for this referee at its store |
| `apiKeyCustomerRead` | `column` | An API key of a tenant this user is a customer of |
| `readableByAll` | — | Anyone reads (reference data) |
| `anyoneInsert` | — | Anyone appends (a request row that commits with the caller's change) |
| `triggerInsert` / `triggerUpdate` / `triggerOrSystemRead` | — | Only a trigger (and, for the read, system) |
| `roleRead` / `roleInsert` / `roleUpdate` / `roleDelete` / `roleAll` | `to`, optional `where` | Only that dedicated database role (retention, erasure, analytics consumer) |

Add `to: "app_runtime"` (or another role from `roles.ts`) to limit any policy to one role.

**Tenant data checks a permission, not only membership (ADR 090).** For a table a member touches, give each command
the catalogue permission its route checks:

```ts
Invoice: [
  { name: "invoice_system", rule: "system" },
  { name: "invoice_read", rule: "permissionRead", resource: "PAYMENT", action: "READ", column: "tenantId" },
  // at the row's store:
  { name: "invoice_write", rule: "permissionUpdate", resource: "PAYMENT", action: "UPDATE", column: "tenantId", storeColumn: "locationId" },
],
```

PostgreSQL makes a writer read the rows it writes (`INSERT … RETURNING`, `UPDATE … WHERE`), so give each write
permission a read policy on the rows it writes too (`invoice_creator_read`). A tenant table writable by every member,
whatever their role (`tenantMemberOrSystem` and friends), fails a test unless listed in `MEMBERSHIP_WRITE_EXCEPTIONS`
with the reason.

A permission rule is written as a check PostgreSQL runs **once per statement**, not once per row (ADR 093). When you
write a one-off rule, use the same helper, `permitted("RESOURCE", "ACTION", tenantColumn, storeColumn?)` from
`generator/permission-check.ts`, never `app_has_permission(…, "tenantId", …)`, which runs for every row.
`pnpm --filter @workspace/api db:security-benchmark` measures the cost at volume.

Prefer `system` alone when no member ever reads the table; keep a member-level read only for what every role's
screens need (the merchant shell), and say why in a comment.

**One-off rules** for a single table (for example `rewardReadable`) live in
`apps/api/prisma/security/generator/table-specific-rules.ts`, each with a one-line description, and are paired with
their table in `TableSpecificRulePair` (`table-policies.ts`). Using one on any other table does not compile, and the
generator refuses it too.

## When no rule fits

Add a rule to `generator/policy-rules.ts` (reusable; add its name to the matching group type in `table-policies.ts`,
such as `ColumnRule`) or `generator/table-specific-rules.ts` (one table; add a `TableSpecificRulePair`): write its
condition once, add a test in `prisma/security/__tests__/table-policies.spec.ts`, and add it to the table above. Then
check what the database does:

```bash
pnpm --filter @workspace/api db:security-snapshot --out /tmp/after.json --compare ../../docs/history/security-baseline-2026-11-18.json
```

It builds a fresh database in a throwaway Docker container and lists every policy, function, role and grant that
changed.

## Other security pieces

| You want to change | File |
|---|---|
| A database role, or what a role may touch | `apps/api/prisma/security/roles.ts` |
| A table `app_runtime` may never update or delete | `apps/api/prisma/security/withheld-privileges.ts` |
| A trigger | `apps/api/prisma/security/triggers.ts` |
| A helper function the policies call | `apps/api/prisma/security/generator/functions/` |
| Which tables a system operation reaches | `apps/api/src/prisma/system-operation.registry.ts` |

Each of them is regenerated by the same command, `pnpm --filter @workspace/api db:security`.
