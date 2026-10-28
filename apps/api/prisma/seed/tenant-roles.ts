// The two row shapes ADR 067 changed for every seed: a membership names its tenant's role
// copy, and a grant has no unique key to upsert on.

import type { MembershipRole, Prisma } from "@prisma/client";

import { TenantRoleCopies, type TenantRoleCopiesDb } from "../../src/contexts/authorization/public-api";

/**
 * The tenant's live copy of `role`, copying the templates first if the tenant has none yet
 * (idempotent: a tenant is provisioned once, whichever seed reaches it first).
 */
export async function seedTenantRoleId(db: TenantRoleCopiesDb, tenantId: string, role: MembershipRole): Promise<string> {
	const copies = new TenantRoleCopies(db);
	await copies.provision(tenantId, null);
	return copies.roleIdFor(tenantId, role);
}

/** One grant row, keyed by (user, permission, tenant): `UserPermission` has no unique key to upsert on. */
export interface SeedGrant {
	readonly userId: string;
	readonly permissionId: string;
	readonly tenantId: string | null;
	readonly data: Omit<Prisma.UserPermissionUncheckedCreateInput, "userId" | "permissionId" | "tenantId">;
}

/** Converges the one row of (user, permission, tenant) — soft-deleted rows included — onto `grant.data`. */
export async function upsertSeedGrant(db: Pick<Prisma.TransactionClient, "userPermission">, grant: SeedGrant): Promise<void> {
	const existing = await db.userPermission.findFirst({ where: { userId: grant.userId, permissionId: grant.permissionId, tenantId: grant.tenantId }, select: { id: true } });
	if (existing === null) {
		await db.userPermission.create({ data: { userId: grant.userId, permissionId: grant.permissionId, tenantId: grant.tenantId, ...grant.data } });
		return;
	}
	await db.userPermission.update({ where: { id: existing.id }, data: grant.data });
}
