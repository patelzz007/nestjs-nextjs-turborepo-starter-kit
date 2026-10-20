import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import { PermissionsNotFoundError } from "../../../domain/errors/authorization.errors";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { SyncUserPermissionsCommand } from "./sync-user-permissions.command";

/**
 * Listing a permission the user holds a DENY for is rejected (lift the DENY with an explicit revoke).
 * Every added and every removed grant must be within the actor's reach.
 */
@CommandHandler(SyncUserPermissionsCommand)
export class SyncUserPermissionsHandler implements ICommandHandler<SyncUserPermissionsCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: SyncUserPermissionsCommand): Promise<void> {
		const desired: string[] = [...new Set<string>(command.input.permissionIds)];
		const { userId } = command.input;
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, userId);
			if ((await scope.permissions.countLive(desired)) !== desired.length) {
				throw new PermissionsNotFoundError();
			}
			const removed: readonly string[] = target.syncAllowGrants(desired, actor.userId);
			await this.guard.assertCanGrantPermissions(scope, rbacActor, [...desired, ...removed]);
			await scope.userAuthorizations.save(target);
			return {
				kind: "changed",
				result: undefined,
				audits: [{ action: "USER_PERMISSIONS_SYNCED", targetUserId: userId, detail: JSON.stringify({ permissionIds: desired }) }],
				affectedUserIds: [userId],
			};
		});
	}
}
