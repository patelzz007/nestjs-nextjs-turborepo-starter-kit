import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../prisma/prisma.service";

/** A role and the `ACTION:RESOURCE` keys of its active (non-deleted) permission assignments. */
export interface RoleWithPermissionKeys {
	readonly name: string;
	readonly permissionKeys: readonly string[];
}

/** Read model for the role-assignment preview (`POST /admin/roles/preview`). */
@Injectable()
export class RolePermissionPreviewRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** Non-deleted roles among `roleIds`, each with its live permission keys. Unknown ids are ignored. */
	public async findRolesWithPermissionKeys(roleIds: readonly string[]): Promise<readonly RoleWithPermissionKeys[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const roles = await this.prisma.role.findMany({
			where: { id: { in: [...roleIds] }, isDeleted: false },
			select: {
				name: true,
				rolePermissions: {
					where: { isDeleted: false },
					select: { permission: { select: { action: true, resource: true } } },
				},
			},
		});
		return roles.map((role): RoleWithPermissionKeys => ({
			name: role.name,
			permissionKeys: role.rolePermissions.map((rolePermission): string => `${rolePermission.permission.action}:${rolePermission.permission.resource}`),
		}));
	}
}
