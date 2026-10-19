import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { UnassignRoleCommand } from "./unassign-role.command";

/** A last-holder-protected system role (SuperAdmin, Admin) never loses its last active holder. */
@CommandHandler(UnassignRoleCommand)
export class UnassignRoleHandler implements ICommandHandler<UnassignRoleCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: UnassignRoleCommand): Promise<void> {
		const { userId, roleId } = command.input;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, userId);
			await this.guard.assertCanGrantRoles(scope, rbacActor, [roleId]);
			target.unassignRole(roleId);
			await scope.userAuthorizations.save(target);
			await this.guard.assertProtectedRolesKeepAHolder(scope, [roleId]);
			return { kind: "changed", result: undefined, audits: [{ action: "ROLE_REMOVED", targetUserId: userId, targetRoleId: roleId }], affectedUserIds: [userId] };
		});
	}
}
