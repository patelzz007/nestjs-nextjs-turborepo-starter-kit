import { Injectable, Logger } from "@nestjs/common";

import type { UserPermissions } from "./rbac.interface.js";
import type { SlimRoleResponse, PermissionDetailsResponse } from "./schemas/user.schema.js";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * Role-Based Access Control service.
 *
 * Fetches a user's roles and their accumulated permissions from the database.
 * Permissions are aggregated from all roles assigned to the user.
 */
@Injectable()
export class RbacService {
	private readonly logger: Logger = new Logger(RbacService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Get all roles and aggregated permissions for a user.
	 *
	 * Permission deduplication: If two roles share the same `action + resource`
	 * combination, only one entry is returned.
	 */
	public async getUserPermissions(userId: string): Promise<UserPermissions> {
		// Fetch user roles with their assigned permissions
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId },
			include: {
				role: {
					include: {
						rolePermissions: {
							include: {
								permission: true,
							},
						},
					},
				},
			},
		});

		// Map to SlimRoleResponse
		const roles: SlimRoleResponse[] = userRoles.map((ur) => ({
			id: ur.role.id,
			name: ur.role.name,
			description: ur.role.description,
		}));

		// Aggregate permissions from all roles, deduplicating by action + resource
		const permissionMap = new Map<string, PermissionDetailsResponse>();

		for (const userRole of userRoles) {
			for (const rp of userRole.role.rolePermissions) {
				const key = `${rp.permission.action}:${rp.permission.resource}`;
				if (!permissionMap.has(key)) {
					permissionMap.set(key, {
						id: rp.permission.id,
						action: rp.permission.action,
						resource: rp.permission.resource,
						description: rp.permission.description,
					});
				}
			}
		}

		const permissions: PermissionDetailsResponse[] = Array.from(permissionMap.values());

		return { roles, permissions };
	}
}
