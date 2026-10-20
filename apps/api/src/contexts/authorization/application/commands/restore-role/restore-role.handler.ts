import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { RoleAggregate, RoleState } from "../../../domain/aggregates/role.aggregate";
import { DeletedRoleNotFoundError } from "../../../domain/errors/authorization.errors";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toRoleResponse } from "../../services/rbac-response.mapper";
import { RestoreRoleCommand } from "./restore-role.command";

/**
 * Holders regain the role's permissions and those of every ancestor, so every ancestor (deleted ones
 * included) must be within the actor's reach. Holders are re-authenticated and SoD-checked after the write.
 */
@CommandHandler(RestoreRoleCommand)
export class RestoreRoleHandler implements ICommandHandler<RestoreRoleCommand, RoleResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RestoreRoleCommand): Promise<RoleResponse> {
		const { roleId } = command;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<RoleResponse>> => {
			const role: RoleAggregate | null = await scope.roles.findIncludingDeleted(roleId);
			if (!role?.isDeleted) {
				throw new DeletedRoleNotFoundError(roleId);
			}
			await this.guard.assertNotHoldingRole(scope, rbacActor, roleId);
			await this.guard.assertCanGrantRoles(scope, rbacActor, [roleId]);
			role.restore(this.clock.now());
			const stored: RoleState = await scope.roles.save(role);
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfLineage(roleId);
			await this.guard.assertUsersHaveNoConflicts(scope, affectedUserIds);
			return { kind: "changed", result: toRoleResponse(stored), audits: [{ action: "ROLE_RESTORED", targetRoleId: roleId, detail: stored.name }], affectedUserIds };
		});
	}
}
