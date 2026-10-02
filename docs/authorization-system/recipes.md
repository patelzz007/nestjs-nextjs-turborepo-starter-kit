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
3. `pnpm build:shared`, then re-seed or restart the API (the permission registry syncs on
   startup, the seed upserts rows).
4. **Give it to roles** — in `apps/api/prisma/seed/roles.ts` for defaults, or at runtime in
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
@Delete(":id")
@Authorize({ action: "DELETE", resource: "ORDER", resourceId: "id" })
public async remove(@Param("id") id: string): Promise<void> { … }
```

### 2.3 Tenant- or condition-dependent decisions → authorize in the service

When the decision needs the record's tenant or state (organization, store, status, amount),
load the record **with a tenant-safe query** first (RLS makes this safe, spec §95), then ask
the kernel:

```ts
public async refund(actor: AuthenticatedUser, tenant: VerifiedTenantContext, orderId: string): Promise<void> {
	const order = await this.orders.findById(orderId); // runs under the user's RLS scope
	if (order === null) {
		throw new NotFoundException();
	}

	await this.kernel.authorize({
		subject: { userId: actor.id, isSuperAdmin: actor.isSuperAdmin, organizationId: tenant.organizationId, storeId: tenant.storeId },
		action: "UPDATE",
		resource: "PAYMENT",
		resourceId: order.paymentId,
		resourceAttributes: { organizationId: order.organizationId, storeId: order.storeId, status: order.status, amount: order.total },
	});

	// … business validation (e.g. "COMPLETED → PENDING is invalid") is a SEPARATE step (spec §96)
}
```

Always pass the record's `organizationId` / `storeId` / `locationId` as resource attributes —
without them, `ORGANIZATION` / `STORE` / `LOCATION` grants do not apply (fail closed).
Read the tenant from the request context — `requestContext.current()?.tenant` (the guard verified it), never from
headers or the body.

### 2.4 Checklist

- [ ] Decorator or `kernel.authorize()` on **every** mutation and every privileged read.
- [ ] `401` for unauthenticated, `403` for unauthorized (consider `404` to hide existence, spec §99).
- [ ] An e2e test that calls the endpoint **without** the permission and expects `403`.

---

## 3. Build a list endpoint

```ts
public async list(user: AuthenticatedUser, tenant: VerifiedTenantContext, query: ListQuery): Promise<Order[]> {
	const allowed = await this.kernel.filter(
		{ userId: user.id, isSuperAdmin: user.isSuperAdmin, organizationId: tenant.organizationId, storeId: tenant.storeId },
		"LIST",
		"ORDER",
	);
	return this.prisma.order.findMany({ where: { AND: [allowed, { status: query.status }] }, take: query.limit });
}
```

- ✅ one query; the database does the filtering.
- ❌ never `findMany()` everything and `.filter()` in JavaScript (spec §32, §57).
- The filter assumes columns named `organizationId`, `storeId`, `locationId`, `userId`, `id`.

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
4. Add tests (see [testing](./testing.md#4-frontend-tests)).

Merchant: use `MERCHANT_CAPABILITY.*` and `MerchantCapabilityGate` / `useAuthorization()` — never a membership role name. A new org page also needs a rule in `ORG_PAGE_RULES` and a `guardOrgPage` call (see [frontend §5](./frontend.md#5-merchant-app-appsmerchant)).
Web: use `AccessGate`.

---

## 5. Add a store-scoped feature

**Example:** store staff can close the till in **their** store only.

1. Add STORE-scoped permission rows (recipe 1):

   ```ts
   { action: "UPDATE", resource: "INVENTORY", scope: "STORE", description: "Update inventory at own store", group: "Store Operations" },
   ```

2. Add them to the `Store Manager` / `Store Staff` matrices in `prisma/seed/roles.ts`
   (`hasResourceActions(p, "INVENTORY", ["UPDATE"], "STORE")`), or to a new role in the admin panel.
3. Your table needs `organizationId` and `storeId` columns (plus RLS — recipe 7).
4. The client sends the active store: header **`x-store-id: <storeId>`**. The guard verifies
   the membership (forged → 403).
5. In the service, authorize with the record's tenant:

   ```ts
   await this.kernel.authorize({ subject: { userId, organizationId, storeId }, action: "UPDATE", resource: "INVENTORY",
     resourceId: item.id, resourceAttributes: { organizationId: item.organizationId, storeId: item.storeId } });
   ```

6. Lists: `kernel.filter(...)` returns `{ organizationId, storeId }` for the member's store(s).

Store memberships are created by the seed today (`prisma/seed/stores.ts`: owners / admins →
`Store Manager` in every store their location scope covers, other members → `Store Staff` in
their selected stores). Stores themselves are **never** created by hand — they follow their
location automatically.

---

## 6. Give a new resource an owner

`OWN`-scoped permissions only work for resource types the ownership resolver knows.
Add a case to `apps/api/src/modules/authorization/kernel/resource-ownership.resolver.ts`:

```ts
case "INVOICE": {
	const invoice = await this.prisma.invoice.findFirst({ where: { id: resourceId, isDeleted: false }, select: { userId: true } });
	return invoice === null ? { kind: "missing" } : { kind: "owned", ownerUserId: invoice.userId };
}
```

Add a unit test for owner / non-owner / missing. Never read the owner from the request.

---

## 7. Add a new tenant table with RLS

1. Prisma model with `organizationId` (and `storeId` / `locationId` if relevant), `@@map("snake_case")`,
   an index on the tenant columns, and a `/// RLS:` doc comment like its neighbours.
2. Migration: `pnpm --filter @workspace/api db:migrate:create`, then check the SQL.
3. Add the table name to the right profile in `apps/api/prisma/rls/manifest-index.ts`
   (usually `organization_tenant`).
4. Enable + force RLS and add policies in `apps/api/prisma/rls.sql`, e.g.:

   ```sql
   DROP POLICY IF EXISTS invoices_member ON public.invoices;
   CREATE POLICY invoices_member ON public.invoices
     USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
     WITH CHECK (app_rls_bypass() OR app_tenant_organization_member_of(organization_id));
   ```

5. `pnpm --filter @workspace/api db:check-rls-manifest` → must print "No RLS manifest drift".
6. `pnpm db:apply-security`.
7. Add an e2e test that reads / writes another organization's rows and expects nothing / an error
   (spec §102).

---

## 8. Add a conditional policy (ABAC)

Insert a `policy_definitions` row (seed: `prisma/seed/authorization-kernel.ts`):

```ts
const completedOrderLock: PolicyConditions = {
	condition: { field: "order.status", operator: "equals", value: "COMPLETED" },
};

{
	name: "completed-orders-are-immutable",
	scope: "GLOBAL",
	actions: ["UPDATE", "DELETE"],
	resources: ["ORDER"],
	effect: "DENY",
	conditions: parsePrismaInputJson(PolicyConditionsSchema.parse(completedOrderLock)),
	isActive: true,
	version: 1,
}
```

- Always `PolicyConditionsSchema.parse(...)` before saving — invalid rules must never reach the DB.
- A `DENY` policy blocks when it matches. `ALLOW` policies are **conditional grants**: if any
  exist for the action, at least one must match.
- The endpoint must pass the attributes the rule reads (`resourceAttributes.status`).

---

## 9. Add an ACL exception

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

## 10. Give a user a one-off permission, or take one away

```http
POST /api/v1/admin/permissions/user/grant
{ "userId": "…", "permissionId": "…", "effect": "DENY" }       // Bob keeps his role but cannot delete
```

- `effect: "ALLOW"` requires the admin to hold the permission themselves.
- You cannot change your **own** overrides.
- Optional `expiresAt` (epoch ms) makes it temporary.

---

## 11. Run background work that touches the database

```ts
public async process(job: Job): Promise<void> {
	await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
}
```

New kind of work → add a specific name to `apps/api/src/prisma/system-operation.registry.ts`
with a description. Never inject `SystemPrismaService` for this.

---

## 12. Debug "why was I denied?"

1. Admin with `READ:PERMISSION`:

   ```http
   GET /api/v1/authorization/decisions/explain?action=UPDATE&resource=ORDER&resourceId=order-123&userId=<user>&organizationId=<org>
   ```

2. In code / tests: `await kernel.explain(request)` and read `evaluation`.
3. Check `authorization_audits` for the denied request (every DENY is logged with its reason).
4. Common causes are listed in [troubleshooting](./troubleshooting.md).
