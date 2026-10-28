import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { RoleAggregate } from "../../../domain/aggregates/role.aggregate";
import { PermissionsNotFoundError } from "../../../domain/errors/authorization.errors";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { SyncRolePermissionsCommand } from "./sync-role-permissions.command";

/** Removed permissions (the current lineage) and added ones (the new set) must both be within the actor's reach. */
@CommandHandler(SyncRolePermissionsCommand)
export class SyncRolePermissionsHandler implements ICommandHandler<SyncRolePermissionsCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SyncRolePermissionsCommand): Promise<void> {
		const { roleId } = command;
		const unique: string[] = [...new Set<string>(command.permissionIds)];
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const role: RoleAggregate = await this.guard.requireMutableRole(scope, rbacActor, roleId);
			await this.guard.assertCanGrantPermissions(scope, rbacActor, unique);
			if ((await scope.permissions.countLive(unique)) !== unique.length) {
				throw new PermissionsNotFoundError();
			}
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfRole(roleId);
			role.syncPermissions(unique, actor.userId, this.clock.now());
			await scope.roles.save(role);
			return {
				kind: "changed",
				result: undefined,
				audits: [{ action: "ROLE_PERMISSIONS_SYNCED", targetRoleId: roleId, detail: JSON.stringify({ permissionIds: unique }) }],
				affectedUserIds,
			};
		});
	}
}
