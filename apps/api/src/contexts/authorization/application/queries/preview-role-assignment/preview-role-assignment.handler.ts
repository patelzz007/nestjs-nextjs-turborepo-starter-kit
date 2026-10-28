import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { RoleAssignmentPreviewSchema, type RoleAssignmentPreview } from "@workspace/shared";

import { RBAC_INSPECTION_READ } from "../../ports/authorization.tokens";
import type { DirectOverrideKeys, EffectiveRoleSet, RbacInspectionReader, RbacInspectionReadPort } from "../../ports/rbac-read.port";
import { PreviewRoleAssignmentQuery } from "./preview-role-assignment.query";

/** Effective permission keys: role-conferred ∪ direct ALLOW − direct DENY. */
export function effectivePermissionKeys(roles: EffectiveRoleSet, overrides: DirectOverrideKeys): ReadonlySet<string> {
	const denied: ReadonlySet<string> = new Set<string>(overrides.deny);
	return new Set<string>([...roles.permissionKeys, ...overrides.allow].filter((key: string): boolean => !denied.has(key)));
}

/**
 * Both sides use the model the kernel evaluates, so the diff is exact: direct ALLOW grants survive a role sync (never "lost"), and DENY overrides are subtracted (a denied
 * permission is never "gained"). Read-only.
 */
@QueryHandler(PreviewRoleAssignmentQuery)
export class PreviewRoleAssignmentHandler implements IQueryHandler<PreviewRoleAssignmentQuery, RoleAssignmentPreview> {
	public constructor(@Inject(RBAC_INSPECTION_READ) private readonly inspection: RbacInspectionReadPort) {}

	public async execute(query: PreviewRoleAssignmentQuery): Promise<RoleAssignmentPreview> {
		const { userId, roleIds } = query.proposal;
		return this.inspection.inspect(query.actor, "Preview a role sync for a user", async (reader: RbacInspectionReader): Promise<RoleAssignmentPreview> => {
			const current: EffectiveRoleSet = await reader.effectiveRoleSet(await reader.assignedRoleIds(userId));
			const proposed: EffectiveRoleSet = await reader.effectiveRoleSet(roleIds);
			const overrides: DirectOverrideKeys = await reader.directOverrideKeys(userId);
			const before: ReadonlySet<string> = effectivePermissionKeys(current, overrides);
			const after: ReadonlySet<string> = effectivePermissionKeys(proposed, overrides);
			const currentRoles: ReadonlySet<string> = new Set<string>(current.roleNames);
			const newRoles: ReadonlySet<string> = new Set<string>(proposed.roleNames);
			return RoleAssignmentPreviewSchema.parse({
				currentRoles: [...currentRoles],
				newRoles: [...newRoles],
				roleAdded: [...newRoles].filter((name: string): boolean => !currentRoles.has(name)),
				roleRemoved: [...currentRoles].filter((name: string): boolean => !newRoles.has(name)),
				permissionsGained: [...after].filter((key: string): boolean => !before.has(key)),
				permissionsLost: [...before].filter((key: string): boolean => !after.has(key)),
			});
		});
	}
}
