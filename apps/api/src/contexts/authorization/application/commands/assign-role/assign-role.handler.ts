import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { AssignRoleCommand } from "./assign-role.command";

/** Escalation-checked, limited to `MAX_ROLES_PER_USER` direct roles, and SoD-checked after the write. */
@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: AssignRoleCommand): Promise<void> {
		const { userId, roleId } = command.input;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, userId);
			await this.guard.requireLiveRole(scope, roleId);
			await this.guard.assertCanGrantRoles(scope, rbacActor, [roleId]);
			target.assignRole(roleId, actor.userId);
			await scope.userAuthorizations.save(target);
			await this.guard.assertUsersHaveNoConflicts(scope, [userId]);
			return { kind: "changed", result: undefined, audits: [{ action: "ROLE_ASSIGNED", targetUserId: userId, targetRoleId: roleId }], affectedUserIds: [userId] };
		});
	}
}
