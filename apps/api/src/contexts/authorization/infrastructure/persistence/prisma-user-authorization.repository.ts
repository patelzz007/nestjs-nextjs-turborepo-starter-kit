import type { Prisma } from "@prisma/client";
import { nowEpochMs, type EpochMs } from "@workspace/shared";

import { UserAuthorizationAggregate, type DirectPermissionGrant, type UserAuthorizationChange } from "../../domain/aggregates/user-authorization.aggregate";
import type { UserAuthorizationRepository } from "../../domain/repositories/user-authorization.repository";
import { LoadTestUserConfinedError } from "../../../../platform/domain/errors/load-test-user-confined.error";

/**
 * `UserRole` and `UserPermission` on the RBAC transaction, written only inside the RBAC mutation scope
 * (atomically with the session revocation and the audit row). Soft delete only.
 */
export class PrismaUserAuthorizationRepository implements UserAuthorizationRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findForAccount(userId: string): Promise<UserAuthorizationAggregate | null> {
		const user = await this.db.user.findFirst({ where: { id: userId, isDeleted: false }, select: { id: true, isSuperAdmin: true } });
		if (user === null) {
			return null;
		}
		return this.load(user.id, user.isSuperAdmin);
	}

	public async findWithExpiredOverrides(now: EpochMs, limit: number): Promise<UserAuthorizationAggregate[]> {
		const rows = await this.db.userPermission.findMany({
			where: { isDeleted: false, expiresAt: { not: null, lt: now } },
			select: { userId: true, user: { select: { isSuperAdmin: true } } },
			distinct: ["userId"],
			orderBy: { userId: "asc" },
			take: limit,
		});
		const accounts: UserAuthorizationAggregate[] = [];
		for (const row of rows) {
			accounts.push(await this.load(row.userId, row.user.isSuperAdmin));
		}
		return accounts;
	}

	public async save(authorization: UserAuthorizationAggregate): Promise<void> {
		for (const change of authorization.pullChanges()) {
			await this.apply(authorization.userId, change);
		}
	}

	private async load(userId: string, isSuperAdmin: boolean): Promise<UserAuthorizationAggregate> {
		const [roles, overrides] = await Promise.all([
			this.db.userRole.findMany({ where: { userId, isDeleted: false }, select: { roleId: true } }),
			this.db.userPermission.findMany({
				where: { userId, isDeleted: false },
				select: { id: true, permissionId: true, effect: true, expiresAt: true },
				orderBy: { id: "asc" },
			}),
		]);
		return UserAuthorizationAggregate.rehydrate({
			userId,
			isSuperAdmin,
			roleIds: roles.map((row): string => row.roleId),
			overrides: overrides.map((row) => ({
				id: row.id,
				permissionId: row.permissionId,
				effect: row.effect,
				expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
			})),
		});
	}

	private async apply(userId: string, change: UserAuthorizationChange): Promise<void> {
		switch (change.kind) {
			case "role_assigned":
				await this.assignRole(userId, change.roleId, change.assignedBy);
				return;
			case "role_unassigned":
				await this.db.userRole.updateMany({ where: { userId, roleId: change.roleId, isDeleted: false }, data: this.softDeleted() });
				return;
			case "roles_synced":
				await this.syncRoles(userId, change.roleIds, change.assignedBy);
				return;
			case "permission_granted":
				await this.grant(userId, change.grant, change.assignedBy);
				return;
			case "permission_revoked":
				await this.db.userPermission.updateMany({ where: { userId, permissionId: change.permissionId, isDeleted: false }, data: this.softDeleted() });
				return;
			case "allow_grants_synced":
				await this.syncAllowGrants(userId, change.permissionIds, change.assignedBy);
				return;
			case "overrides_expired":
				// Exactly the listed overrides, still live: the RBAC lock is held, so nothing revived them since the read.
				await this.db.userPermission.updateMany({
					where: { id: { in: [...change.overrideIds] }, isDeleted: false },
					data: { isDeleted: true, deletedAt: change.expiredAt, updatedAt: change.expiredAt },
				});
				return;
		}
	}

	private softDeleted(): { readonly isDeleted: true; readonly deletedAt: number; readonly updatedAt: number } {
		const now: number = nowEpochMs();
		return { isDeleted: true, deletedAt: now, updatedAt: now };
	}

	/** A load-test user never holds a platform role (ADR 068). */
	private async assertNotLoadTestUser(userId: string): Promise<void> {
		const user = await this.db.user.findFirst({ where: { id: userId }, select: { isLoadTestUser: true } });
		if (user?.isLoadTestUser === true) {
			throw new LoadTestUserConfinedError(userId);
		}
	}

	private async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
		await this.assertNotLoadTestUser(userId);
		const now: number = nowEpochMs();
		await this.db.userRole.upsert({
			where: { userId_roleId: { userId, roleId } },
			create: { userId, roleId, assignedBy },
			update: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
	}

	/** Soft-delete unlisted roles, revive listed rows, insert new ones. */
	private async syncRoles(userId: string, roleIds: readonly string[], assignedBy: string): Promise<void> {
		const now: number = nowEpochMs();
		await this.db.userRole.updateMany({ where: { userId, isDeleted: false, roleId: { notIn: [...roleIds] } }, data: { isDeleted: true, deletedAt: now, updatedAt: now } });
		if (roleIds.length === 0) {
			return;
		}
		await this.assertNotLoadTestUser(userId);
		await this.db.userRole.updateMany({
			where: { userId, roleId: { in: [...roleIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		await this.db.userRole.createMany({ data: roleIds.map((roleId: string) => ({ userId, roleId, assignedBy })), skipDuplicates: true });
	}

	/** A platform grant (no tenant): one row per user and permission, revived rather than duplicated. */
	private async grant(userId: string, grant: DirectPermissionGrant, assignedBy: string): Promise<void> {
		const now: number = nowEpochMs();
		const existing = await this.db.userPermission.findFirst({ where: { userId, permissionId: grant.permissionId, tenantId: null }, select: { id: true } });
		if (existing === null) {
			await this.db.userPermission.create({ data: { userId, permissionId: grant.permissionId, effect: grant.effect, expiresAt: grant.expiresAt ?? null, assignedBy } });
			return;
		}
		await this.db.userPermission.update({
			where: { id: existing.id },
			data: {
				isDeleted: false,
				deletedAt: null,
				effect: grant.effect,
				assignedBy,
				assignedAt: now,
				updatedAt: now,
				...(grant.expiresAt === undefined ? {} : { expiresAt: grant.expiresAt }),
			},
		});
	}

	/**
	 * Replace the direct ALLOW grants (no expiry). DENY overrides are never touched here: they are lifted
	 * only through an explicit, escalation-checked revoke.
	 */
	private async syncAllowGrants(userId: string, permissionIds: readonly string[], assignedBy: string): Promise<void> {
		const now: number = nowEpochMs();
		await this.db.userPermission.updateMany({
			where: { userId, isDeleted: false, effect: "ALLOW", permissionId: { notIn: [...permissionIds] } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		if (permissionIds.length === 0) {
			return;
		}
		// Revive soft-deleted rows as ALLOW grants (the unique key makes createMany skip them).
		await this.db.userPermission.updateMany({
			where: { userId, permissionId: { in: [...permissionIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, effect: "ALLOW", expiresAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		// Listed live ALLOW grants keep the row but lose any expiry: sync means "permanently granted".
		await this.db.userPermission.updateMany({
			where: { userId, permissionId: { in: [...permissionIds] }, isDeleted: false, effect: "ALLOW" },
			data: { expiresAt: null, updatedAt: now },
		});
		await this.db.userPermission.createMany({ data: permissionIds.map((permissionId: string) => ({ userId, permissionId, assignedBy })), skipDuplicates: true });
	}
}
