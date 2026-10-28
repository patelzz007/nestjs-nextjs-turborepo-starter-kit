---
title: "Authorization Recipes"
tags: ["authorization", "how-to", "recipes", "permissions", "rls"]
description: "Step-by-step recipes: add a permission, protect an endpoint, build a list endpoint, gate a button, add a store-scoped feature, add ownership, add a tenant table with RLS, write policies and ACLs, run background jobs, and debug a denial."
order: 24
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization Recipes

> [!NOTE]
> Each recipe is a checklist you can follow top to bottom. Background is in the
> [backend](./backend.md), [tenancy](./tenancy-and-rls.md) and [frontend](./frontend.md) guides.

---

## 1. Add a new permission

**Example:** customers need to export reports → `EXPORT` is not an action, so we use `READ` on
a new resource… but first check whether an existing `(action, resource)` already fits.

1. **Resource exists?** Check `PermissionResourceSchema` in
   `packages/shared/src/schemas/domain/platform/enums.ts`. If not:
   - add the value to `enum PermissionResource` in `apps/api/prisma/schema.prisma`,
   - add it to `PermissionResourceSchema`,
   - add `NEW_RESOURCE: actionSlugs("NEW_RESOURCE")` to `PERMISSION` in
     `packages/shared/src/authorization/permission.ts` (the compiler forces this),
   - create a migration (`pnpm --filter @workspace/api db:migrate:create`).
2. **Add the row(s)** to `PERMISSION_DEFINITIONS` in
   `packages/shared/src/schemas/domain/rbac/permissions-registry.ts`:

   ```ts
   { action: "READ", resource: "REPORT", description: "View any report", group: "Reports" },
   { action: "READ", resource: "REPORT", scope: "OWN", description: "View own reports", group: "Own Records" },
   ```

   One row per scope you need. No `scope` means `GLOBAL`.
3. `pnpm tools build:shared`, then run `pnpm --filter @workspace/api db:sync-reference-data` (or re-seed) so
   the permission row exists; deployments run it on every deploy.
4. **Give it to roles** — in `apps/api/src/contexts/authorization/infrastructure/reference-data/system-role-catalog.ts` for defaults, or at runtime in
   the admin panel (*Access control*). Remember the [escalation rules](./backend.md#11-protecting-authorization-administration-privilege-escalation):
   you can only grant what you hold.
5. The frontend can now use `PERMISSION.REPORT.READ` immediately.

---

## 2. Protect a new endpoint

### 2.1 No specific record (lists, create, dashboards)

```ts
@Get()
@RequirePermission("LIST", "REPORT")
public async list(): Promise<ReportList> { … }
```

### 2.2 A specific record

```ts
// Someone acting on another person's record: the permission, and this record.
@Patch(":userId/unlock")
@RequirePermission("UPDATE", "USER")
@RequirePermission("UPDATE", "USER", { resourceId: "userId" })
public async unlock(@Param("userId") userId: string): Promise<void> { … }

// The caller's own account: the record check alone (everyone may update their own user).
@Post("change-password")
@RequirePermission("UPDATE", "USER", { resourceId: self() })
public async changePassword(…): Promise<void> { … }
```

Every `@RequirePermission` on a route must pass.

### 2.3 Tenant- or condition-dependent decisions → authorize in the service

When the decision needs the record's tenant or state (tenant, store, status, amount),
load the record **with a tenant-safe query** first (RLS makes this safe, spec §95), then ask
the kernel:

```ts
public async refund(actor: AuthenticatedUser, tenant: VerifiedTenantContext, orderId: string): Promise<void> {
	const order = await this.orders.findById(orderId); // runs under the user's RLS scope
	if (order === null) {
		throw new NotFoundException();
	}

	await this.kernel.authorize({
		subject: { userId: actor.id, isSuperAdmin: actor.isSuperAdmin, tenantId: tenant.tenantId, locationId: tenant.locationId },
		action: "UPDATE",
		resource: "PAYMENT",
		resourceId: order.paymentId,
		resourceAttributes: { tenantId: order.tenantId, locationId: order.locationId, status: order.status, amount: order.total },
	});

	// … business validation (e.g. "COMPLETED → PENDING is invalid") is a SEPARATE step (spec §96)
}
```

Always pass the record's `tenantId` / `locationId` as resource attributes —
without them, `TENANT` / `LOCATION` grants do not apply (fail closed).
Read the tenant from the request context — `requestContext.current()?.tenant` (the guard verified it), never from
headers or the body.

### 2.4 Checklist

- [ ] Decorator or `kernel.authorize()` on **every** mutation and every privileged read.
- [ ] `401` for unauthenticated, `403` for unauthorized (consider `404` to hide existence, spec §99).
- [ ] An e2e test that calls the endpoint **without** the permission and expects `403`.

---

## 3. Build a list endpoint

```ts
@Get()
@RequirePermission("LIST", "REWARD")
public async list(@CurrentActor() actor: ActorContext, @ZodQuery(RewardListQuerySchema) query: RewardListQuery): Promise<RewardListResponse> {
	return this.rewards.list(actor, query); // the repository's where clause narrows; RLS hides other tenants' rows
}
```

- ✅ one query; the database does the filtering (`where` for what the screen asks, RLS for the tenant).
- ❌ never `findMany()` everything and `.filter()` in JavaScript.

---

## 4. Gate a button or page in the admin app

1. Find the API route the button calls and its permission (e.g. `POST /admin/roles/user/assign`
   → `@RequirePermission("UPDATE", "ROLE")`).
2. In the **container** component:

   ```tsx
   const { can } = useAuthorization();
   return can(PERMISSION.ROLE.UPDATE)
     ? <AssignRoleButton onClick={assign} />
     : <AccessRestrictedNotice>You can view roles but not assign them.</AccessRestrictedNotice>;
   ```

3. **New page?** Add its menu item to `lib/navigation/sidebar-menu.json` and its requirement to
   `ADMIN_MENU_AUTHORIZATION` in `lib/navigation/menu-authorization.ts`:

   ```ts
   // GET /admin/reports (LIST REPORT)
   ["/reports", { permissions: [PERMISSION.REPORT.LIST] }],
   ```

   The sidebar, command palette and route guard pick it up automatically.
   `@SuperAdminOnly` pages go into the explicit `superAdminOnly` route rules instead.
4. Add tests (see [frontend tests](#frontend-tests)).

Merchant: use `MERCHANT_CAPABILITY.*` and `MerchantCapabilityGate` / `useAuthorization()` — never a membership role name. A new org page also needs a rule in `ORG_PAGE_RULES` and a `guardOrgPage` call (see [frontend §5](./frontend.md#5-merchant-app-appsmerchant)).
Web: use `AccessGate`.

---

## 5. Add a location-scoped feature

**Example:** location staff can close the till at **their** location only.

1. Add LOCATION-scoped permission rows (recipe 1):

   ```ts
   { action: "UPDATE", resource: "INVENTORY", scope: "LOCATION", description: "Update inventory at own location", group: "Location Operations" },
   ```

2. Add them to the `Location Manager` / `Location Staff` matrices in `apps/api/src/contexts/authorization/infrastructure/reference-data/system-role-catalog.ts`
   (`matchesAny(p, "INVENTORY", ["UPDATE"], "LOCATION")`), then re-run `db:sync-reference-data`, or to a new role in the admin panel.
3. Your table needs `tenantId` and `locationId` columns (plus RLS — recipe 7).
4. The client names the location in the route, query or body (`locationId`). The guard verifies
   the member's location scope (another tenant's location, or one outside the scope → refused).
5. In the service, authorize with the record's tenant and location:

   ```ts
   await this.kernel.authorize({ subject: { userId, tenantId, locationId }, action: "UPDATE", resource: "INVENTORY",
     resourceId: item.id, resourceAttributes: { tenantId: item.tenantId, locationId: item.locationId } });
   ```

6. Lists: narrow the query to the member's location(s) in its `where` clause; RLS keeps other tenants out.

A location role is the `roleId` of a member's `SELECTED` location scope row
(`MembershipLocationScope`). The seed assigns them (`prisma/seed/location-roles.ts`: owners /
admins → `Location Manager`, other members → `Location Staff`, on their selected locations).

---

## 6. Give a new resource an owner

`OWN`-scoped permissions only work for resource types the ownership resolver knows.
Add a case to `apps/api/src/contexts/authorization/infrastructure/kernel/resource-ownership.resolver.ts`:

```ts
case "INVOICE": {
	const invoice = await this.prisma.invoice.findFirst({ where: { id: resourceId, isDeleted: false }, select: { userId: true } });
	return invoice === null ? { kind: "missing" } : { kind: "owned", ownerUserId: invoice.userId };
}
```

Add a unit test for owner / non-owner / missing. Never read the owner from the request.

---

## 7. Add a new tenant table with RLS

1. Prisma model with `tenantId` (and `locationId` if relevant), `@@map("snake_case")`,
   an index on the tenant columns, and a `/// RLS:` doc comment like its neighbours.
2. Migration: `pnpm --filter @workspace/api db:migrate:create`, then check the SQL.
3. Add the table name to the right profile in `apps/api/prisma/rls/manifest-index.ts`
   (usually `tenant_tenant`).
4. Enable + force RLS and add policies in `apps/api/prisma/rls.sql`, e.g.:

   ```sql
   DROP POLICY IF EXISTS invoices_member ON public.invoices;
   CREATE POLICY invoices_member ON public.invoices
     USING (app_rls_bypass() OR app_tenant_tenant_member_of(tenant_id))
     WITH CHECK (app_rls_bypass() OR app_tenant_tenant_member_of(tenant_id));
   ```

5. `pnpm --filter @workspace/api db:check-rls-manifest` → must print "No RLS manifest drift".
6. `pnpm tools db:apply-security`.
7. Add an e2e test that reads / writes another tenant's rows and expects nothing / an error
   (spec §102).

---

## 8. Add an ACL exception

```ts
await aclService.createAcl({
	subjectType: "USER", subjectId: bobId,
	action: "DELETE", resourceType: "ORDER", resourceId: "order-123",
	effect: "DENY", reason: "Disputed order — do not delete", assignedBy: adminId,
});
```

Use ACLs for **exceptions only** (spec §124). If you are creating one per record, you want a
scope or ownership instead.

---

## 9. Give a user a one-off permission, or take one away

```http
POST /api/v1/admin/permissions/user/grant
{ "userId": "…", "permissionId": "…", "effect": "DENY" }       // Bob keeps his role but cannot delete
```

- `effect: "ALLOW"` requires the admin to hold the permission themselves.
- You cannot change your **own** overrides.
- Optional `expiresAt` (epoch ms) makes it temporary.

---

## 10. Run background work that touches the database

```ts
public async process(job: Job): Promise<void> {
	await runWithSystemRlsContext("queue.email.send", async (): Promise<void> => this.handle(job));
}
```

New kind of work → add a specific name to `apps/api/src/prisma/system-operation.registry.ts`
with a description. Never inject `SystemPrismaService` for this.

---

## 11. Debug "why was I denied?"

1. Admin with `READ:PERMISSION`:

   ```http
   GET /api/v1/authorization/decisions/explain?action=UPDATE&resource=ORDER&resourceId=order-123&userId=<user>&tenantId=<org>
   ```

2. In code / tests: `await kernel.explain(request)` and read `evaluation`.
3. Check `AuthorizationAudit` for the denied request (every DENY is logged with its reason).
4. Common causes are listed under [troubleshooting](#12-troubleshooting).

---

## 12. Troubleshooting

### 13.1 "I get 403 but I should be allowed"

| Symptom | Likely cause | Fix |
|---|---|---|
| 403 on a self-service route (change password, 2FA) | the route has a collection-level `@RequirePermission`, or the caller is anonymous | self-service routes declare only `@RequirePermission(…, { resourceId: self() })` |
| 403 although the role has the permission | a `DENY` override or ACL `DENY` exists | `explain()` shows `source: "override"` or `"acl"` |
| 403 with a `TENANT` / `LOCATION` scoped role | no verified tenant or location, or the record's tenant attributes were not passed | call the `:tenantSlug` route (and name the `locationId`); pass `resourceAttributes: { tenantId, locationId }` |
| 403 with an `OWN` scoped role on a list | `OWN` grants never satisfy collection-level checks | `OWN` applies per record (`resourceId`); a list needs a broader grant |
| 403 on a tenant member with no roles | membership is not permission | assign a role / store membership role |
| Merchant cashier gets 403 creating a reward | expected: the Cashier template has no `reward.update` (`TENANT_ROLE_TEMPLATES`) | use an Owner / Manager account, or grant it (`POST /tenants/:tenantSlug/access/members/:membershipId/grants`) |
| Merchant `403 TENANT_ROLE_CAPABILITY_REQUIRED` on team / locations / KYB | the role lacks `merchant:manage_team` / `manage_locations` / `manage_verification` (KYB is owner-only, admins included) | use an account whose role holds it |
| Merchant page shows "You don't have access to this page" | `guardOrgPage` denied it on the server: the role lacks the capability in `ORG_PAGE_RULES`, or the URL names a tenant you do not belong to | expected; the sidebar hides such pages |
| Admin gets 403 assigning a role | subset rule: the admin does not hold every permission of that role, or they are editing themselves | ask a SuperAdmin, or grant the admin those permissions first |
| 403 uploading a store logo / KYB document | needs `merchant:manage_locations` (logo, banner — Owner / Manager) or `merchant:manage_verification` (KYB — `OWNER`) | check what the member's role gives in Settings → Team & permissions → Roles |

### 13.2 "A menu item / button is missing"

| Cause | Fix |
|---|---|
| The page's requirement in `ADMIN_MENU_AUTHORIZATION` is not held | check `GET /auth/permissions` in the browser network tab |
| Permissions changed recently | the list refreshes on window focus and every 60 s; reload to force |
| The item has a `featureFlag` that is not enabled | enable the flag (`lib/feature-flags.ts`) |
| Merchant: the membership role lacks the capability | see the tenant's roles (`GET /tenants/:tenantSlug/access/roles`) and the member's grants |
| You forgot the provider in a new app / layout | without a provider every check denies |

### 13.3 "RLS" errors

| Symptom | Cause | Fix |
|---|---|---|
| `new row violates row-level security policy for table "X"` | the code runs under a user scope but the table needs bypass (e.g. `OutboxEvent`), or the row's tenant does not match | run the write inside a named system operation, or pass the right tenant |
| A query returns nothing in a background job | no RLS scope → the fail-closed anonymous context | wrap the job in `runWithSystemRlsContext("queue.<your-job>", …)` after registering that name |
| `System operation not allowlisted: …` | new system-operation name not registered | add it to `src/prisma/system-operation.registry.ts` |
| `Tenant database access requires tenant context` | a scoped user query with no tenant in multi-tenant mode | call the route under `/tenants/:tenantSlug`, or use `TenantTransactionService.withTenantTransaction` |

### 13.4 Reset / seed problems

| Symptom | Cause | Fix |
|---|---|---|
| `Error: deadlock detected` during `db:apply-security` | another connection (running API, workers, Prisma Studio) touches the same tables | stop the API; the script now retries automatically with a lock timeout |
| New permissions / roles missing after seeding | the seed read an old `@workspace/shared` build | `pnpm tools build:shared`, then seed again |
| Seed fails with "Seed data missing …" / "Seed role … is missing" | seeds ran out of order | run the full `pnpm db:seed` after `db:reset` |
| Logins return `429` in e2e tests | the Redis throttler remembers earlier runs | wait a few minutes |

### 13.5 FAQ

**Can I create a role without deploying?**
Yes. Roles, role permissions, store memberships and overrides are data (spec §49). Only new
**permission types** (a new action × resource × scope) need code, because real code must
implement them (spec §119, §120).

**Do I need a new RLS policy for a new role?**
No — never (spec §50).

**Why does a SuperAdmin see everything in the UI?**
The backend bypasses checks for them, so `/auth/permissions` returns every platform
capability; otherwise the UI would hide things they are actually allowed to use.

**Why did my logout stop being "bypass"?**
Refresh / logout now run scoped to the token's user. Anything they must write to
infrastructure tables goes through named system operations (e.g. `outbox.enqueue`).

**What is `SystemPrismaService` for?**
A second database client that ignores RLS, used only for startup permission sync, the
capability catalog sync and authorization audit writes. Feature code must not use it — see
[tenancy → the two database clients](./tenancy-and-rls.md#7-the-two-database-clients).

---

## 13. Testing

Authorization bugs are silent: a missing check still "works". That is why **negative tests**
("this must be denied") matter more here than anywhere else.

### Running them

```bash
pnpm run test                              # every workspace (includes the API unit suite)
pnpm --filter @workspace/api test          # API unit tests only
pnpm ci:local --e2e-only                   # the database e2e suites, on throwaway databases
```

The API e2e suites (`apps/api/test`: `authorization-*.e2e-spec.ts`, `access-hardening`,
`rls-hardening`, `tenant-isolation`, `merchant-capabilities`, and `test/tenancy`, `test/rls`) boot
the real app against PostgreSQL with RLS applied. `ci:local` creates and drops their throwaway
databases; never point them at your dev database. If logins start returning `429`, the Redis
throttler still remembers an earlier run: wait a couple of minutes.

The kernel's own unit tests sit beside it (`apps/api/src/contexts/authorization/infrastructure/kernel/__tests__/`),
and the guard's in `apps/api/src/platform/presentation/http/security/guards/__tests__/`.

### House patterns for API unit tests (no casts)

The strict rules forbid `as` casts, so mocks replace **modules** instead of casting objects:

```ts
const mocks = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
	},
}));
```

- For HTTP contexts use `apps/api/test/support/http-execution-context.ts` (`createHttpContext`,
  `testRequest`, `accessToken`): a real Nest `ExecutionContext` whose handler carries the metadata.
- Build **complete** Prisma fixtures (every field) instead of partial objects.

### Frontend tests

```tsx
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import { PERMISSION } from "@workspace/shared";

it("hides Assign role without ROLE.UPDATE", () => {
	render(
		<CapabilitiesProvider capabilities={[PERMISSION.ROLE.READ]}>
			<UserAccessPanel userId="u-1" />
		</CapabilitiesProvider>,
	);
	expect(screen.queryByRole("button", { name: /assign role/i })).toBeNull();
});
```

Merchant tests use the helpers in `apps/merchant/test/authorization.tsx`.

### What every new gated feature must test

- [ ] **Allowed**: the user with the permission can do it (API) and sees it (UI).
- [ ] **Denied**: the user without it gets `403` (API) and does not see it (UI).
- [ ] **Cross-tenant**: an Org A user against an Org B record is denied for read, create, update, delete and list.
- [ ] **Forged ids**: tenant ids in headers or the body for someone else's tenant are rejected.
- [ ] **Direct API call**: the endpoint is denied even though the button is hidden.
- [ ] **Precedence** (if you add ACLs, overrides or policies): DENY beats ALLOW.
- [ ] **Loading**: no denial flash while permissions load (frontend).

---

## 14. Dos and don'ts

Use this as a pull-request checklist. The repo-wide list is [Dos and don'ts](../dos-and-donts.md).

### Backend

| ✅ Do | Why |
| --- | --- |
| Put a decorator (`@RequirePermission`, `@SuperAdminOnly`) or a `kernel.authorize()` call on **every** mutation and privileged read | The frontend can be bypassed with `curl`. |
| Add `{ resourceId }` to `@RequirePermission`, or call `kernel.authorize()` with the record, when the answer depends on **which** record | A permission is a capability "somewhere", not "on every record". |
| Pass the record's `tenantId` / `locationId` as resource attributes | Tenant-scoped grants fail closed without them ([kernel §5.2](./backend.md#52-what-each-scope-means)). |
| Read the tenant from the request context (`requestContext.current()?.tenant`) | It is verified; headers and bodies are not ([tenancy §2](./tenancy-and-rls.md#2-client-tenant-ids-are-requests-not-facts)). |
| Narrow list queries in the database (`where` + RLS) | One query, no data leak, no N+1. |
| Keep business validation separate from authorization | "May they?" and "is this state change valid?" are different questions with different errors. |
| Use `self()` for self-service routes | Implicit own-account grants apply only to the caller's own record. |
| Parse policy and ACL conditions with `PolicyConditionsSchema` before saving | A malformed rule must never reach the database. |
| Add a new, specific system-operation name for new background work | Every RLS bypass stays explicit and auditable ([ADR 012](../../adr/012-system-operations.md)). |
| Return the generic 403 (`AuthorizationException`) | Never tell an attacker which rule failed; use `explain()` to debug. |
| Change roles and permissions only through the authorization commands, with the real actor | One audited transaction, escalation checks, token revocation and cache invalidation come with it ([mutation contract](./backend.md#111-the-rbac-mutation-contract)). |

| ❌ Don't | Why |
| --- | --- |
| `if (user.role === "ADMIN")` in business code (merchant: `role === "OWNER"`, role lists) | Roles are data; permissions are the vocabulary. Use the kernel; merchant code uses `MERCHANT_CAPABILITY.*` (`requireMembershipCapability`). |
| Treat tenant membership as permission | Membership only lets **scoped** permissions apply; it grants nothing by itself. |
| Trust `tenantId` / `locationId` / `ownerId` from the body or headers | Forged tenant ids and ownership claims are the classic multi-tenant bug. |
| Load all rows and filter in JavaScript | Leaks data into memory and logs, and is slow. |
| Store JavaScript or SQL as policies, or `eval` anything | Remote code execution. Conditions use the validated JSON rule language. |
| Create an RLS policy per role | Roles are dynamic; RLS protects stable tenant concepts. |
| Inject `SystemPrismaService` into feature code | It ignores RLS entirely. Use a named system operation. |
| Hard-code `actorId: "system"` in audits | Audits name the real actor: `{ kind: "USER", userId }`, or `{ kind: "SYSTEM_OPERATION", operation }` for a scheduled job. |
| Let an admin grant what they do not hold, or edit their own roles | Privilege escalation. `domain/policies/rbac-escalation.policy.ts` enforces this — never bypass it. |
| Put permissions or roles into the JWT | Tokens grow and go stale ([ADR 003](../../adr/003-jwt-identity-only.md)). |
| Add a decision cache "just in case" | Measure first; grants are already cached per user ([caches](./backend.md#caches-and-invalidation)). |
| Add CASL / Oso / Cerbos / OpenFGA next to the kernel | One engine ([ADR 026](../../adr/026-kernel-first-authorization.md)). |

### Frontend

| ✅ Do | Why |
| --- | --- |
| Use `useAuthorization().can(...)` or `<Can>` | One API in every app. |
| Use `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants | A typo fails at compile time instead of silently denying forever. |
| Mirror the **exact** permission of the API route the component calls | UI and API stay consistent. |
| Gate in container (smart) components | Presentational components stay reusable. |
| Hide navigation; hide or disable actions with a reason; show a fallback for whole sections | Consistent UX ([frontend §3](./frontend.md#3-ux-rules--what-to-do-when-something-is-not-allowed)). |
| Render nothing or a skeleton while permissions load | Allowed users never see a denial flash. |
| Let the API decide about one record (it answers `403`) | The browser must not re-implement ownership, scope or policy. |
| Add new admin pages to the menu config **and** `ADMIN_MENU_AUTHORIZATION` | Sidebar, palette and route guard stay in sync. |

| ❌ Don't | Why |
| --- | --- |
| Treat a hidden button as protection | UX only. |
| `user.role === "MANAGER" && user.locationId === order.locationId` in a component | Re-implements the kernel badly. |
| Type slug strings (`"platform:user.delete"`) | See the constants rule above. |
| Call the API for every `can()` | Checks are local; use the decisions endpoint only for batches of per-record checks. |
| Mark unauthorized menu items `disabled` | `disabled` means "switched off", not "forbidden" — hide them. |
| Encode feature flags or subscription plans as permissions | Separate concerns, separate lifecycles. |
| Put authorization logic inside the sidebar component | Filter the config first, render second. |

### Database and RLS

| ✅ Do | ❌ Don't |
| --- | --- |
| Add every new tenant table to `prisma/rls/manifest-index.ts` and give it policies ([profiles](./tenancy-and-rls.md#8-policy-profiles-and-sql-helpers)) | Ship a table without RLS "for now" |
| Run `pnpm --filter @workspace/api db:check-rls-manifest` | Rely on application filters alone |
| Stop the API before `db:reset` / `db:apply-security` | Run RLS DDL while workers hammer the same tables |
| `pnpm tools build:shared` before seeding | Seed against a stale shared build (new permissions go missing) |
| Use `TenantTransactionService` for multi-statement tenant work | Call `set_config` yourself |
