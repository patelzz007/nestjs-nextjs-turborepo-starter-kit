import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { nowEpochMs, RoleAssignmentPreviewSchema, type RoleAssignmentPreview } from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { RolePermissionPreviewRepository, type DirectOverrideKeys, type EffectiveRoleSet } from "../repositories/role-permission-preview.repository";

/** Effective permission keys: role-conferred (incl. inherited) ∪ direct ALLOW − direct DENY. */
function effectivePermissions(roles: EffectiveRoleSet, overrides: DirectOverrideKeys): Set<string> {
	const denied: ReadonlySet<string> = new Set<string>(overrides.deny);
	return new Set<string>([...roles.permissionKeys, ...overrides.allow].filter((key: string): boolean => !denied.has(key)));
}

/**
 * Dry-run of "replace this user's roles with `roleIds`": what they would gain
 * and lose. Read-only — nothing is assigned.
 *
 * Both sides are computed with the same model the kernel uses, so the diff is
 * exact: permissions inherited from ancestor roles count, the user's direct
 * ALLOW grants stay (they survive a role sync, so they are never "lost"), and
 * direct DENY overrides are subtracted (a denied permission is never "gained").
 * Permission keys are `ACTION:RESOURCE` strings.
 *
 * The target's assignments and overrides are own-row RLS tables, so they are
 * read under the allowlisted `authorization.rbac.inspect` operation after the
 * route permission check.
 */
@Injectable()
export class RoleAssignmentPreviewService {
	public constructor(
		private readonly repository: RolePermissionPreviewRepository,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async preview(actorId: string, userId: string, roleIds: readonly string[]): Promise<RoleAssignmentPreview> {
		return this.tenantTx.withSystemOperation(
			{ operation: "authorization.rbac.inspect", reason: "Preview a role sync for a user", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<RoleAssignmentPreview> => {
				const currentRoleIds: string[] = await this.repository.findAssignedRoleIds(userId, tx);
				const current: EffectiveRoleSet = await this.repository.findEffectiveRoleSet(currentRoleIds, tx);
				const proposed: EffectiveRoleSet = await this.repository.findEffectiveRoleSet(roleIds, tx);
				const overrides: DirectOverrideKeys = await this.repository.findDirectOverrideKeys(userId, nowEpochMs(), tx);

				const before: ReadonlySet<string> = effectivePermissions(current, overrides);
				const after: ReadonlySet<string> = effectivePermissions(proposed, overrides);
				const currentRoles: ReadonlySet<string> = new Set<string>(current.roleNames);
				const newRoleSet: ReadonlySet<string> = new Set<string>(proposed.roleNames);

				return RoleAssignmentPreviewSchema.parse({
					currentRoles: [...currentRoles],
					newRoles: [...newRoleSet],
					roleAdded: [...newRoleSet].filter((name: string): boolean => !currentRoles.has(name)),
					roleRemoved: [...currentRoles].filter((name: string): boolean => !newRoleSet.has(name)),
					permissionsGained: [...after].filter((key: string): boolean => !before.has(key)),
					permissionsLost: [...before].filter((key: string): boolean => !after.has(key)),
				});
			},
		);
	}
}
