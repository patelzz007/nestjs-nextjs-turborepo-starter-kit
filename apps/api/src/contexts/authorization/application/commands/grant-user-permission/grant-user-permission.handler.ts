import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import { PermissionNotFoundError } from "../../../domain/errors/authorization.errors";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { GrantUserPermissionCommand } from "./grant-user-permission.command";

/**
 * Either way the actor must hold the permission: an ALLOW hands it out, and a DENY strips it. A lesser
 * administrator can do neither for powers beyond its own. The target's sessions are revoked.
 */
@CommandHandler(GrantUserPermissionCommand)
export class GrantUserPermissionHandler implements ICommandHandler<GrantUserPermissionCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: GrantUserPermissionCommand): Promise<void> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, input.userId);
			if ((await scope.permissions.findLive(input.permissionId)) === null) {
				throw new PermissionNotFoundError(input.permissionId);
			}
			await this.guard.assertCanGrantPermissions(scope, rbacActor, [input.permissionId]);
			target.grantPermission({ permissionId: input.permissionId, effect: input.effect, expiresAt: input.expiresAt }, actor.userId);
			await scope.userAuthorizations.save(target);
			return {
				kind: "changed",
				result: undefined,
				audits: [
					{
						action: "PERMISSION_GRANTED",
						targetUserId: input.userId,
						permissionId: input.permissionId,
						detail: JSON.stringify({ effect: input.effect, expiresAt: input.expiresAt ?? null }),
					},
				],
				affectedUserIds: [input.userId],
			};
		});
	}
}
