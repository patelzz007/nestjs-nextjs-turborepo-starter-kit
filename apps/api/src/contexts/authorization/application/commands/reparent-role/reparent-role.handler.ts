import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { RoleAggregate, RoleState } from "../../../domain/aggregates/role.aggregate";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toRoleResponse } from "../../services/rbac-response.mapper";
import { ReparentRoleCommand } from "./reparent-role.command";

/** Both the old lineage (the role itself) and the new parent's lineage must be within the actor's reach. */
@CommandHandler(ReparentRoleCommand)
export class ReparentRoleHandler implements ICommandHandler<ReparentRoleCommand, RoleResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReparentRoleCommand): Promise<RoleResponse> {
		const { roleId, parentId } = command;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<RoleResponse>> => {
			const role: RoleAggregate = await this.guard.requireMutableRole(scope, rbacActor, roleId);
			let parent: RoleAggregate | null = null;
			let parentAncestry: ReadonlySet<string> = new Set<string>();
			if (parentId !== null) {
				parent = await this.guard.requireLiveRole(scope, parentId);
				await this.guard.assertCanGrantRoles(scope, rbacActor, [parentId]);
				parentAncestry = await scope.rbacGraph.withAllAncestors([parentId]);
			}
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfLineage(roleId);
			role.reparent(parent, parentAncestry, this.clock.now());
			const stored: RoleState = await scope.roles.save(role);
			await this.guard.assertUsersHaveNoConflicts(scope, affectedUserIds);
			return {
				kind: "changed",
				result: toRoleResponse(stored),
				audits: [{ action: "ROLE_PARENT_SET", targetRoleId: roleId, detail: JSON.stringify({ parentId }) }],
				affectedUserIds,
			};
		});
	}
}
