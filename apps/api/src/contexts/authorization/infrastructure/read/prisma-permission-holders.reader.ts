import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { nowEpochMs, type PermissionAction, type PermissionResource } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PERMISSION_HOLDERS_READ_OPERATION } from "../../application/ports/authorization.tokens";
import type { PermissionHoldersReadPort } from "../../application/ports/permission-holders-read.port";
import { resolvePermissionHolders } from "../../domain/policies/permission-holders.policy";

/** The audited actor of the read, or `null` for a non-user actor. */
function actorUserIdOf(actor: ActorContext): string | null {
	if (actor.kind === "user") {
		return actor.userId;
	}
	return actor.kind === "system" ? actor.actorUserId : null;
}

/**
 * {@link PermissionHoldersReadPort} over Prisma, under `authorization.permission_holders.read`
 * (the RBAC tables are bypass-only). A fixed number of statements, whatever the number of holders.
 */
@Injectable()
export class PrismaPermissionHoldersReader implements PermissionHoldersReadPort {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public holdersOf(actor: ActorContext, action: PermissionAction, resource: PermissionResource): Promise<readonly string[]> {
		return this.tenantTx.withSystemOperation(
			{ operation: PERMISSION_HOLDERS_READ_OPERATION, reason: `holders of ${action} ${resource}`, actorUserId: actorUserIdOf(actor) },
			async (db: Prisma.TransactionClient): Promise<readonly string[]> => {
				const nowMs = nowEpochMs();
				const permissionWhere = { resource, action, isDeleted: false } satisfies Prisma.PermissionWhereInput;
				const liveOverride = {
					isDeleted: false,
					permission: permissionWhere,
					OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
				} satisfies Prisma.UserPermissionWhereInput;
				const [rolePermissions, overrides, superAdmins] = await Promise.all([
					db.rolePermission.findMany({ where: { isDeleted: false, permission: permissionWhere, role: { isDeleted: false, isActive: true } }, select: { roleId: true } }),
					db.userPermission.findMany({ where: liveOverride, select: { userId: true, effect: true } }),
					db.user.findMany({ where: { isSuperAdmin: true }, select: { id: true } }),
				]);
				const roleIds: string[] = [...new Set<string>(rolePermissions.map((row) => row.roleId))];
				const [userRoles, locationScopes] =
					roleIds.length === 0
						? [[], []]
						: await Promise.all([
								db.userRole.findMany({ where: { roleId: { in: roleIds }, isDeleted: false }, select: { userId: true } }),
								db.membershipLocationScope.findMany({
									where: { roleId: { in: roleIds }, isDeleted: false, membership: { isDeleted: false } },
									select: { membership: { select: { userId: true } } },
								}),
							]);
				const candidates = [
					...new Set<string>([
						...userRoles.map((row) => row.userId),
						...locationScopes.map((row) => row.membership.userId),
						...overrides.map((row) => row.userId),
						...superAdmins.map((row) => row.id),
					]),
				];
				const activeUsers = await db.user.findMany({ where: { id: { in: candidates }, isDeleted: false, isActive: true }, select: { id: true } });
				return resolvePermissionHolders({
					roleHolders: [...userRoles.map((row) => row.userId), ...locationScopes.map((row) => row.membership.userId)],
					directAllow: overrides.filter((row) => row.effect === "ALLOW").map((row) => row.userId),
					directDeny: overrides.filter((row) => row.effect === "DENY").map((row) => row.userId),
					superAdmins: superAdmins.map((row) => row.id),
					activeUsers: activeUsers.map((row) => row.id),
				});
			},
		);
	}
}
