import { Injectable, Logger } from "@nestjs/common";

import type { PermissionDetailsResponse, SlimRoleResponse, UserPermissions } from "@workspace/shared";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Role-Based Access Control service.
 *
 * Fetches a user's roles and their accumulated permissions from the database.
 * Permissions are aggregated from assigned roles, ancestor roles (`parentId`),
 * and non-expired `UserPermission` rows.
 */
@Injectable()
export class RbacService {
	private readonly logger: Logger = new Logger(RbacService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Get all roles and aggregated permissions for a user.
	 *
	 * Permission deduplication: If two roles share the same `action + resource`
	 * combination, only one entry is returned. Direct user grants overwrite the
	 * same key.
	 */
	public async getUserPermissions(userId: string): Promise<UserPermissions> {
		const nowMs: number = Date.now();

		const userRoles = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false, isActive: true } },
			include: {
				role: {
					select: { id: true, name: true, description: true, parentId: true },
				},
			},
		});

		const roles: SlimRoleResponse[] = userRoles.map((ur) => ({
			id: ur.role.id,
			name: ur.role.name,
			description: ur.role.description,
		}));

		const roleIds: string[] = await this.collectRoleHierarchyIds(userRoles.map((ur) => ur.role));

		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: {
				roleId: { in: roleIds },
				isDeleted: false,
				permission: { isDeleted: false },
			},
			include: { permission: true },
		});

		const userPermissions = await this.prisma.userPermission.findMany({
			where: {
				userId,
				isDeleted: false,
				permission: { isDeleted: false },
				OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
			},
			include: { permission: true },
		});

		const permissionMap = new Map<string, PermissionDetailsResponse>();

		for (const rp of rolePermissions) {
			this.putPermission(permissionMap, {
				id: rp.permission.id,
				action: rp.permission.action,
				resource: rp.permission.resource,
				description: rp.permission.description,
			});
		}

		for (const up of userPermissions) {
			this.putPermission(permissionMap, {
				id: up.permission.id,
				action: up.permission.action,
				resource: up.permission.resource,
				description: up.permission.description,
			});
		}

		const permissions: PermissionDetailsResponse[] = Array.from(permissionMap.values());
		this.logger.debug(`Resolved ${String(permissions.length)} permissions for user ${userId}`);

		return { roles, permissions };
	}

	private putPermission(permissionMap: Map<string, PermissionDetailsResponse>, permission: PermissionDetailsResponse): void {
		const key = `${permission.action}:${permission.resource}`;
		permissionMap.set(key, permission);
	}

	private async collectRoleHierarchyIds(start: readonly { readonly id: string; readonly parentId: string | null }[]): Promise<string[]> {
		const roleIds = new Set<string>();
		let frontier: readonly { readonly id: string; readonly parentId: string | null }[] = start;

		while (frontier.length > 0) {
			const parentIds: string[] = [];
			for (const role of frontier) {
				if (roleIds.has(role.id)) {
					continue;
				}
				roleIds.add(role.id);
				if (role.parentId !== null && !roleIds.has(role.parentId)) {
					parentIds.push(role.parentId);
				}
			}
			if (parentIds.length === 0) {
				break;
			}
			frontier = await this.prisma.role.findMany({
				where: { id: { in: parentIds }, isDeleted: false, isActive: true },
				select: { id: true, parentId: true },
			});
		}

		return Array.from(roleIds);
	}
}
