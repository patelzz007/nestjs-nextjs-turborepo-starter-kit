// ============================================
// infrastructure/access/tenant-role-copies.ts — each tenant's own Owner / Manager / Cashier (ADR 067)
// ============================================
// Design patterns:
//   - PROTOTYPE: a tenant's roles are COPIES of the platform's TEMPLATE roles,
//     made when the tenant is created; a template change reaches new tenants
//     only, and `resetToTemplate` re-copies one role on request.
//   - Works on the caller's transaction (Unit of Work): the copies are written
//     in the same transaction as the tenant, so a tenant never exists without
//     its roles.
// The templates are database rows (kind TEMPLATE) kept equal to the code table
// `TENANT_ROLE_TEMPLATES` by the catalogue sync: a template change is a code change
// (reviewed and deployed); each tenant edits its own copies.

import type { MembershipRole, Prisma } from "@prisma/client";

/** The tables this class touches, on whatever transaction the caller holds. */
export type TenantRoleCopiesDb = Pick<Prisma.TransactionClient, "role" | "rolePermission">;

/** A tenant's copy of a template is missing: its roles were never provisioned (a deployment error). */
export class TenantRoleMissingError extends Error {
	public constructor(tenantId: string, template: MembershipRole) {
		super(`Tenant ${tenantId} has no ${template} role — tenant roles are copied from the templates when the tenant is created`);
		this.name = "TenantRoleMissingError";
	}
}

const LIVE = { isDeleted: false };

export class TenantRoleCopies {
	public constructor(private readonly db: TenantRoleCopiesDb) {}

	/** Copies every template the tenant does not have yet (idempotent). */
	public async provision(tenantId: string, actorUserId: string | null): Promise<void> {
		const templates = await this.db.role.findMany({ where: { kind: "TEMPLATE", ...LIVE }, include: { rolePermissions: { where: LIVE } } });
		const existing = await this.db.role.findMany({ where: { tenantId, kind: "TENANT", ...LIVE }, select: { templateKey: true } });
		for (const template of templates) {
			if (template.templateKey === null || existing.some((copy) => copy.templateKey === template.templateKey)) {
				continue;
			}
			const copy = await this.db.role.create({
				data: { name: template.name, description: template.description, kind: "TENANT", tenantId, templateKey: template.templateKey, isSystem: false, createdBy: actorUserId },
			});
			await this.db.rolePermission.createMany({ data: template.rolePermissions.map((row) => ({ roleId: copy.id, permissionId: row.permissionId, assignedBy: actorUserId })) });
		}
	}

	/** The tenant's live copy of `template` — the role a new member of that template gets. */
	public async roleIdFor(tenantId: string, template: MembershipRole): Promise<string> {
		const role = await this.db.role.findFirst({ where: { tenantId, kind: "TENANT", templateKey: template, ...LIVE }, select: { id: true } });
		if (role === null) {
			throw new TenantRoleMissingError(tenantId, template);
		}
		return role.id;
	}

	/** Makes a tenant role's permissions equal its template's again (soft-deleting the rest). */
	public async resetToTemplate(roleId: string, template: MembershipRole, actorUserId: string, now: bigint): Promise<void> {
		const source = await this.db.role.findFirst({ where: { kind: "TEMPLATE", templateKey: template, ...LIVE }, include: { rolePermissions: { where: LIVE } } });
		if (source === null) {
			throw new TenantRoleMissingError("(template)", template);
		}
		await this.setPermissions(
			roleId,
			source.rolePermissions.map((row) => row.permissionId),
			actorUserId,
			now,
		);
	}

	/**
	 * Makes a role hold exactly `permissionIds`: the one place a role's permission set is replaced,
	 * used by editing a role and by resetting it to its template alike.
	 */
	public async setPermissions(roleId: string, permissionIds: readonly string[], actorUserId: string, now: bigint): Promise<void> {
		const wanted = new Set(permissionIds);
		// Every row ever written for the role: a soft-deleted one is revived rather than duplicated
		// (one row per role and permission).
		const rows = await this.db.rolePermission.findMany({ where: { roleId } });
		const removed = rows.filter((row) => !row.isDeleted && !wanted.has(row.permissionId)).map((row) => row.id);
		if (removed.length > 0) {
			await this.db.rolePermission.updateMany({ where: { id: { in: removed } }, data: { isDeleted: true, deletedAt: now, deletedBy: actorUserId, updatedAt: now } });
		}
		const revived = rows.filter((row) => row.isDeleted && wanted.has(row.permissionId)).map((row) => row.id);
		if (revived.length > 0) {
			await this.db.rolePermission.updateMany({
				where: { id: { in: revived } },
				data: { isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: now, assignedBy: actorUserId },
			});
		}
		const known = new Set(rows.map((row) => row.permissionId));
		const added = [...wanted].filter((permissionId) => !known.has(permissionId));
		if (added.length > 0) {
			await this.db.rolePermission.createMany({ data: added.map((permissionId) => ({ roleId, permissionId, assignedBy: actorUserId })) });
		}
	}
}
