import { Injectable } from "@nestjs/common";
import type { AclEffect, Permission, Prisma, UserPermission, UserRole } from "@prisma/client";

import { nowEpochMs } from "@workspace/shared";

/** One live (non-deleted) direct permission override of a user. */
export interface DirectPermissionOverride {
	readonly permissionId: string;
	readonly effect: AclEffect;
}

/** A live direct override past its expiry. */
export interface ExpiredDirectOverride {
	readonly id: string;
	readonly userId: string;
	readonly permissionId: string;
	readonly effect: AclEffect;
}

/** The account an RBAC change targets. */
export interface RbacTargetUser {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

/** A direct permission grant to write. `expiresAt === undefined` keeps an existing expiry on re-grant. */
export interface DirectPermissionGrant {
	readonly userId: string;
	readonly permissionId: string;
	readonly effect: AclEffect;
	readonly expiresAt: number | undefined;
	readonly assignedBy: string;
}

/**
 * Persistence for the RBAC join tables (`user_roles`, `role_permissions`,
 * `user_permissions`). Every method takes the caller's transaction client:
 * assignments only change inside `RbacMutationRunner`, atomically with the
 * session revocation and the audit row. Soft delete only.
 */
@Injectable()
export class RoleAssignmentRepository {
	// ── Reads ────────────────────────────────────────────────────────────

	/** The target account's platform flags, or `null` when no non-deleted user has that id. */
	public async findTargetUser(userId: string, db: Prisma.TransactionClient): Promise<RbacTargetUser | null> {
		return db.user.findFirst({ where: { id: userId, isDeleted: false }, select: { id: true, isSuperAdmin: true } });
	}

	/** Users holding any of `roleIds` — directly (`user_roles`) or through an active store membership. */
	public async findActiveHolderIds(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<string[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const [userRoles, storeMemberships] = await Promise.all([
			db.userRole.findMany({ where: { roleId: { in: [...roleIds] }, isDeleted: false }, select: { userId: true } }),
			db.storeMembership.findMany({ where: { roleId: { in: [...roleIds] }, isDeleted: false }, select: { userId: true } }),
		]);
		return [...new Set<string>([...userRoles, ...storeMemberships].map((row): string => row.userId))];
	}

	/** Live directly assigned role ids of `userId` (the roles' own state is not filtered). */
	public async findAssignedRoleIds(userId: string, db: Prisma.TransactionClient): Promise<string[]> {
		const rows = await db.userRole.findMany({ where: { userId, isDeleted: false }, select: { roleId: true } });
		return rows.map((row): string => row.roleId);
	}

	/** Whether `userId` has a live direct assignment of `roleId`. */
	public async isRoleAssigned(userId: string, roleId: string, db: Prisma.TransactionClient): Promise<boolean> {
		const count = await db.userRole.count({ where: { userId, roleId, isDeleted: false } });
		return count > 0;
	}

	/** Active, non-deleted users that directly hold `roleId`. */
	public async countActiveHolders(roleId: string, db: Prisma.TransactionClient): Promise<number> {
		return db.userRole.count({ where: { roleId, isDeleted: false, user: { isDeleted: false, isActive: true } } });
	}

	/** Live permission ids assigned to `roleId`. */
	public async findRolePermissionIds(roleId: string, db: Prisma.TransactionClient): Promise<string[]> {
		const rows = await db.rolePermission.findMany({ where: { roleId, isDeleted: false }, select: { permissionId: true } });
		return rows.map((row): string => row.permissionId);
	}

	/** `ACTION:RESOURCE` pairs conferred by `roleIds` (live assignments of live permissions). */
	public async findRolePermissionKeys(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<Pick<Permission, "action" | "resource">[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const rows = await db.rolePermission.findMany({
			where: { roleId: { in: [...roleIds] }, isDeleted: false, permission: { isDeleted: false } },
			select: { permission: { select: { action: true, resource: true } } },
		});
		return rows.map((row) => row.permission);
	}

	/** Live direct overrides (ALLOW and DENY) of `userId`, expired ones included — they are still rows an admin manages. */
	public async findDirectOverrides(userId: string, db: Prisma.TransactionClient): Promise<DirectPermissionOverride[]> {
		return db.userPermission.findMany({ where: { userId, isDeleted: false }, select: { permissionId: true, effect: true } });
	}

	/** Users affected by a change to `permissionId`: direct override holders plus holders of any role assigning it. */
	public async findAffectedUserIdsByPermission(permissionId: string, db: Prisma.TransactionClient): Promise<string[]> {
		const [rolePermissions, directPermissions] = await Promise.all([
			db.rolePermission.findMany({ where: { permissionId, isDeleted: false }, select: { roleId: true } }),
			db.userPermission.findMany({ where: { permissionId, isDeleted: false }, select: { userId: true } }),
		]);
		const holders = await this.findActiveHolderIds(
			rolePermissions.map((row): string => row.roleId),
			db,
		);
		return [...new Set<string>([...directPermissions.map((row): string => row.userId), ...holders])];
	}

	// ── Role → permission ────────────────────────────────────────────────

	/** Replace the role's permission set: revive listed rows, soft-delete the rest, insert new ones. */
	public async syncRolePermissions(roleId: string, permissionIds: readonly string[], assignedBy: string, db: Prisma.TransactionClient): Promise<void> {
		const now = nowEpochMs();
		await db.rolePermission.updateMany({
			where: { roleId, isDeleted: false, permissionId: { notIn: [...permissionIds] } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		if (permissionIds.length === 0) {
			return;
		}
		// Revive previously soft-deleted rows (the unique key makes createMany skip them).
		await db.rolePermission.updateMany({
			where: { roleId, permissionId: { in: [...permissionIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		await db.rolePermission.createMany({
			data: permissionIds.map((permissionId) => ({ roleId, permissionId, assignedBy })),
			skipDuplicates: true,
		});
	}

	// ── User → role ──────────────────────────────────────────────────────

	public async assignRoleToUser(userId: string, roleId: string, assignedBy: string, db: Prisma.TransactionClient): Promise<UserRole> {
		const now = nowEpochMs();
		return db.userRole.upsert({
			where: { userId_roleId: { userId, roleId } },
			create: { userId, roleId, assignedBy },
			update: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
	}

	/** @returns whether a live assignment was removed. */
	public async removeRoleFromUser(userId: string, roleId: string, db: Prisma.TransactionClient): Promise<boolean> {
		const now = nowEpochMs();
		const { count } = await db.userRole.updateMany({
			where: { userId, roleId, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		return count > 0;
	}

	/** Replace the user's role set: soft-delete unlisted roles, revive listed rows, insert new ones. */
	public async syncUserRoles(userId: string, roleIds: readonly string[], assignedBy: string, db: Prisma.TransactionClient): Promise<void> {
		const now = nowEpochMs();
		await db.userRole.updateMany({
			where: { userId, isDeleted: false, roleId: { notIn: [...roleIds] } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		if (roleIds.length === 0) {
			return;
		}
		// Revive previously soft-deleted rows (the unique key makes createMany skip them).
		await db.userRole.updateMany({
			where: { userId, roleId: { in: [...roleIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		await db.userRole.createMany({
			data: roleIds.map((roleId) => ({ userId, roleId, assignedBy })),
			skipDuplicates: true,
		});
	}

	// ── User → direct permission ─────────────────────────────────────────

	public async givePermissionToUser(grant: DirectPermissionGrant, db: Prisma.TransactionClient): Promise<UserPermission> {
		const now = nowEpochMs();
		return db.userPermission.upsert({
			where: { userId_permissionId: { userId: grant.userId, permissionId: grant.permissionId } },
			create: { userId: grant.userId, permissionId: grant.permissionId, effect: grant.effect, expiresAt: grant.expiresAt ?? null, assignedBy: grant.assignedBy },
			update: {
				isDeleted: false,
				deletedAt: null,
				effect: grant.effect,
				assignedBy: grant.assignedBy,
				assignedAt: now,
				updatedAt: now,
				...(grant.expiresAt !== undefined ? { expiresAt: grant.expiresAt } : {}),
			},
		});
	}

	/** @returns whether a live override was removed. */
	public async revokePermissionFromUser(userId: string, permissionId: string, db: Prisma.TransactionClient): Promise<boolean> {
		const now = nowEpochMs();
		const { count } = await db.userPermission.updateMany({
			where: { userId, permissionId, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		return count > 0;
	}

	/** Live direct overrides (ALLOW or DENY) whose `expiresAt` is before `nowMs`. */
	public async findExpiredOverrides(nowMs: number, db: Prisma.TransactionClient): Promise<ExpiredDirectOverride[]> {
		return db.userPermission.findMany({
			where: { isDeleted: false, expiresAt: { not: null, lt: nowMs } },
			select: { id: true, userId: true, permissionId: true, effect: true },
			orderBy: { id: "asc" },
		});
	}

	/** Soft-delete exactly the listed overrides (still live). @returns how many were expired. */
	public async expireOverrides(ids: readonly string[], nowMs: number, db: Prisma.TransactionClient): Promise<number> {
		if (ids.length === 0) {
			return 0;
		}
		const { count } = await db.userPermission.updateMany({
			where: { id: { in: [...ids] }, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowMs, updatedAt: nowMs },
		});
		return count;
	}

	/**
	 * Replace the user's direct **ALLOW** grants with `permissionIds` (no expiry).
	 * DENY overrides are never touched here — they are lifted only through an
	 * explicit revoke, which is escalation-checked on its own.
	 */
	public async syncUserAllowGrants(userId: string, permissionIds: readonly string[], assignedBy: string, db: Prisma.TransactionClient): Promise<void> {
		const now = nowEpochMs();
		await db.userPermission.updateMany({
			where: { userId, isDeleted: false, effect: "ALLOW", permissionId: { notIn: [...permissionIds] } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		if (permissionIds.length === 0) {
			return;
		}
		// Revive soft-deleted rows as ALLOW grants (the unique key makes createMany skip them).
		await db.userPermission.updateMany({
			where: { userId, permissionId: { in: [...permissionIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, effect: "ALLOW", expiresAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		// Listed live ALLOW grants keep the row but lose any expiry: sync means "permanently granted".
		await db.userPermission.updateMany({
			where: { userId, permissionId: { in: [...permissionIds] }, isDeleted: false, effect: "ALLOW" },
			data: { expiresAt: null, updatedAt: now },
		});
		await db.userPermission.createMany({
			// `effect` defaults to ALLOW.
			data: permissionIds.map((permissionId) => ({ userId, permissionId, assignedBy })),
			skipDuplicates: true,
		});
	}
}
