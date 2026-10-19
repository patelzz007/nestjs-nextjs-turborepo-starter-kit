import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { RevokeUserPermissionCommand } from "./revoke-user-permission.command";

/** Lifting a DENY is as privileged as granting, so the revoke is subset-checked too. */
@CommandHandler(RevokeUserPermissionCommand)
export class RevokeUserPermissionHandler implements ICommandHandler<RevokeUserPermissionCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: RevokeUserPermissionCommand): Promise<void> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, input.userId);
			await this.guard.assertCanGrantPermissions(scope, rbacActor, [input.permissionId]);
			target.revokePermission(input.permissionId);
			await scope.userAuthorizations.save(target);
			return {
				kind: "changed",
				result: undefined,
				audits: [{ action: "PERMISSION_REVOKED", targetUserId: input.userId, permissionId: input.permissionId }],
				affectedUserIds: [input.userId],
			};
		});
	}
}
