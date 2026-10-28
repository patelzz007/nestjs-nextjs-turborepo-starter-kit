import type { Prisma } from "@prisma/client";

import type { ProtectedRoleHolders } from "../../domain/policies/protected-role-holder.policy";
import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";
import type { RbacGraphReader, RbacMutationLock } from "../../application/ports/rbac-graph.port";

/**
 * `pg_advisory_xact_lock` key that serializes every RBAC mutation. RBAC writes are rare, and their
 * invariants (privilege subset, last protected holder, separation of duties) read state other writers
 * change; one lock makes each check-then-write race-free. Arbitrary but fixed 64-bit value; must not
 * collide with other advisory-lock users.
 */
export const RBAC_MUTATION_ADVISORY_LOCK_KEY = 7_324_150_901_011n;

export class PrismaRbacMutationLock implements RbacMutationLock {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async acquire(): Promise<void> {
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(${RBAC_MUTATION_ADVISORY_LOCK_KEY})`;
	}
}

/** Holder and role reads of an RBAC mutation, on its transaction. */
export class PrismaRbacGraphReader implements RbacGraphReader {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async holdersOfRole(roleId: string): Promise<string[]> {
		return this.activeHolderIds([roleId]);
	}

	/** Direct holders of the permission plus every holder of a role that confers it. */
	public async holdersOfPermission(permissionId: string): Promise<string[]> {
		const [rolePermissions, directPermissions] = await Promise.all([
			this.db.rolePermission.findMany({ where: { permissionId, isDeleted: false }, select: { roleId: true } }),
			this.db.userPermission.findMany({ where: { permissionId, isDeleted: false }, select: { userId: true } }),
		]);
		const holders: string[] = await this.activeHolderIds([...new Set<string>(rolePermissions.map((row): string => row.roleId))]);
		return [...new Set<string>([...directPermissions.map((row): string => row.userId), ...holders])];
	}

	public async permissionPairsConferredBy(roleIds: readonly string[]): Promise<RbacPermissionPair[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const rows = await this.db.rolePermission.findMany({
			where: { roleId: { in: [...roleIds] }, isDeleted: false, permission: { isDeleted: false } },
			select: { permission: { select: { action: true, resource: true } } },
		});
		return rows.map((row): RbacPermissionPair => row.permission);
	}

	public async assignedRoleIds(userId: string): Promise<string[]> {
		const rows = await this.db.userRole.findMany({ where: { userId, isDeleted: false }, select: { roleId: true } });
		return rows.map((row): string => row.roleId);
	}

	public async activeRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>> {
		if (roleIds.length === 0) {
			return new Set<string>();
		}
		const rows = await this.db.role.findMany({ where: { id: { in: [...roleIds] }, isDeleted: false, isActive: true }, select: { name: true } });
		return new Set<string>(rows.map((row): string => row.name));
	}

	public async protectedRoleHolders(roleNames: readonly string[]): Promise<ProtectedRoleHolders[]> {
		const roles = await this.db.role.findMany({ where: { name: { in: [...roleNames] }, isSystem: true, isDeleted: false }, select: { id: true, name: true } });
		const holders: ProtectedRoleHolders[] = [];
		for (const role of roles) {
			const activeHolders: number = await this.db.userRole.count({ where: { roleId: role.id, isDeleted: false, user: { isDeleted: false, isActive: true } } });
			holders.push({ roleId: role.id, roleName: role.name, activeHolders });
		}
		return holders;
	}

	/** Users holding any of `roleIds`: directly (`UserRole`) or as the location role of a live location scope. */
	private async activeHolderIds(roleIds: readonly string[]): Promise<string[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const [userRoles, locationScopes] = await Promise.all([
			this.db.userRole.findMany({ where: { roleId: { in: [...roleIds] }, isDeleted: false }, select: { userId: true } }),
			this.db.membershipLocationScope.findMany({
				where: { roleId: { in: [...roleIds] }, isDeleted: false, membership: { isDeleted: false } },
				select: { membership: { select: { userId: true } } },
			}),
		]);
		return [...new Set<string>([...userRoles.map((row): string => row.userId), ...locationScopes.map((row): string => row.membership.userId)])];
	}
}
