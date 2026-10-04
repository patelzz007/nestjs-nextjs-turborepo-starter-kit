import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/** The effective role set for a list of directly assigned roles. */
export interface EffectiveRoleSet {
	/** Names of the directly assigned roles that are live and active (what the user "has"). */
	readonly roleNames: readonly string[];
	/** `ACTION:RESOURCE` keys conferred by those roles and every live, active ancestor. */
	readonly permissionKeys: readonly string[];
}

/** A user's live, unexpired direct overrides as `ACTION:RESOURCE` keys. */
export interface DirectOverrideKeys {
	readonly allow: readonly string[];
	readonly deny: readonly string[];
}

function permissionKey(permission: { readonly action: string; readonly resource: string }): string {
	return `${permission.action}:${permission.resource}`;
}

/**
 * Read model for the role-assignment preview (`POST /admin/roles/preview`).
 * Mirrors the kernel's grant resolution: active, non-deleted roles; their
 * active, non-deleted ancestors; live role permissions; live, unexpired direct
 * ALLOW / DENY overrides. Reads run on the caller's (inspect) transaction.
 */
@Injectable()
export class RolePermissionPreviewRepository {
	/** Live directly assigned role ids of `userId`. */
	public async findAssignedRoleIds(userId: string, db: Prisma.TransactionClient): Promise<string[]> {
		const rows = await db.userRole.findMany({ where: { userId, isDeleted: false }, select: { roleId: true } });
		return rows.map((row): string => row.roleId);
	}

	/** Effective names + permission keys of `roleIds` (inherited permissions included). Unknown, deleted or inactive roles confer nothing. */
	public async findEffectiveRoleSet(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<EffectiveRoleSet> {
		if (roleIds.length === 0) {
			return { roleNames: [], permissionKeys: [] };
		}
		const direct = await db.role.findMany({ where: { id: { in: [...roleIds] }, isDeleted: false, isActive: true }, select: { id: true, name: true, parentId: true } });
		const lineage = new Set<string>();
		let frontier: { readonly id: string; readonly parentId: string | null }[] = direct;
		while (frontier.length > 0) {
			const parentIds: string[] = [];
			for (const role of frontier) {
				lineage.add(role.id);
				if (role.parentId !== null && !lineage.has(role.parentId)) {
					parentIds.push(role.parentId);
				}
			}
			frontier =
				parentIds.length === 0 ? [] : await db.role.findMany({ where: { id: { in: parentIds }, isDeleted: false, isActive: true }, select: { id: true, parentId: true } });
		}
		const rolePermissions = await db.rolePermission.findMany({
			where: { roleId: { in: [...lineage] }, isDeleted: false, permission: { isDeleted: false } },
			select: { permission: { select: { action: true, resource: true } } },
		});
		return {
			roleNames: direct.map((role): string => role.name),
			permissionKeys: [...new Set<string>(rolePermissions.map((row): string => permissionKey(row.permission)))],
		};
	}

	/** Live, unexpired direct overrides of `userId` (as of `nowMs`) on live permissions. */
	public async findDirectOverrideKeys(userId: string, nowMs: number, db: Prisma.TransactionClient): Promise<DirectOverrideKeys> {
		const rows = await db.userPermission.findMany({
			where: { userId, isDeleted: false, permission: { isDeleted: false }, OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }] },
			select: { effect: true, permission: { select: { action: true, resource: true } } },
		});
		return {
			allow: rows.filter((row): boolean => row.effect === "ALLOW").map((row): string => permissionKey(row.permission)),
			deny: rows.filter((row): boolean => row.effect === "DENY").map((row): string => permissionKey(row.permission)),
		};
	}
}
