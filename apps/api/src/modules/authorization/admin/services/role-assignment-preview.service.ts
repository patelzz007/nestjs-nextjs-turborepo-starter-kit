import { Inject, Injectable } from "@nestjs/common";
import { RoleAssignmentPreviewSchema, type RoleAssignmentPreview, type UserPermissions } from "@workspace/shared";

import { AuthorizationCheckerService } from "../../services/authorization-checker.service";
import { RolePermissionPreviewRepository, type RoleWithPermissionKeys } from "../repositories/role-permission-preview.repository";

/**
 * Dry-run of "replace this user's roles with `roleIds`": what they would
 * gain and lose. Read-only — nothing is assigned. Permission keys are
 * `ACTION:RESOURCE` strings (direct user grants are not part of the diff).
 */
@Injectable()
export class RoleAssignmentPreviewService {
	public constructor(
		// Narrowed to the one capability this service needs (interface segregation);
		// the explicit token keeps Nest DI working for the `Pick<>` type.
		@Inject(AuthorizationCheckerService)
		private readonly checker: Pick<AuthorizationCheckerService, "getUserPermissionDetails">,
		private readonly roles: RolePermissionPreviewRepository,
	) {}

	public async preview(userId: string, roleIds: readonly string[]): Promise<RoleAssignmentPreview> {
		const [current, proposedRoles]: [UserPermissions, readonly RoleWithPermissionKeys[]] = await Promise.all([
			this.checker.getUserPermissionDetails(userId),
			this.roles.findRolesWithPermissionKeys(roleIds),
		]);

		const currentPermissions: ReadonlySet<string> = new Set<string>(current.permissions.map((permission): string => `${permission.action}:${permission.resource}`));
		const currentRoles: ReadonlySet<string> = new Set<string>(current.roles.map((role): string => role.name));
		const newRoles: readonly string[] = proposedRoles.map((role: RoleWithPermissionKeys): string => role.name);
		const newRoleSet: ReadonlySet<string> = new Set<string>(newRoles);
		const newPermissions: ReadonlySet<string> = new Set<string>(proposedRoles.flatMap((role: RoleWithPermissionKeys): readonly string[] => role.permissionKeys));

		return RoleAssignmentPreviewSchema.parse({
			currentRoles: [...currentRoles],
			newRoles,
			roleAdded: newRoles.filter((name: string): boolean => !currentRoles.has(name)),
			roleRemoved: [...currentRoles].filter((name: string): boolean => !newRoleSet.has(name)),
			permissionsGained: [...newPermissions].filter((key: string): boolean => !currentPermissions.has(key)),
			permissionsLost: [...currentPermissions].filter((key: string): boolean => !newPermissions.has(key)),
		});
	}
}
