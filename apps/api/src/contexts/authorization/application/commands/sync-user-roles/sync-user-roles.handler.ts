import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UserAuthorizationAggregate, type RoleSyncDiff } from "../../../domain/aggregates/user-authorization.aggregate";
import type { RbacActor } from "../../../domain/policies/rbac-escalation.policy";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { SyncUserRolesCommand } from "./sync-user-roles.command";

/** Every added and every removed role must be within the actor's reach; SoD and the last protected holder are checked after the write. */
@CommandHandler(SyncUserRolesCommand)
export class SyncUserRolesHandler implements ICommandHandler<SyncUserRolesCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: SyncUserRolesCommand): Promise<void> {
		const { userId } = command.input;
		const desired: string[] = [...new Set<string>(command.input.roleIds)];
		// The role limit is a request-shape rule: rejected before any read, as the API always did.
		UserAuthorizationAggregate.assertWithinRoleLimit(desired.length);
		const actor = requireUserActor(command.actor);
		const rbacActor: RbacActor = rbacActorOf(actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const target: UserAuthorizationAggregate = await this.guard.requireManageableAccount(scope, rbacActor, userId);
			for (const roleId of desired) {
				await this.guard.requireLiveRole(scope, roleId);
			}
			const diff: RoleSyncDiff = target.syncRoles(desired, actor.userId);
			await this.guard.assertCanGrantRoles(scope, rbacActor, [...diff.added, ...diff.removed]);
			await scope.userAuthorizations.save(target);
			await this.guard.assertUsersHaveNoConflicts(scope, [userId]);
			await this.guard.assertProtectedRolesKeepAHolder(scope, diff.removed);
			return {
				kind: "changed",
				result: undefined,
				audits: [{ action: "USER_ROLES_SYNCED", targetUserId: userId, detail: JSON.stringify({ roleIds: desired }) }],
				affectedUserIds: [userId],
			};
		});
	}
}
