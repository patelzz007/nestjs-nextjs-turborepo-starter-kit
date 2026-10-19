import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { RoleAggregate } from "../../../domain/aggregates/role.aggregate";
import type { UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import { PlatformRoleNotConfiguredError, RbacTargetUserNotFoundError } from "../../../domain/errors/authorization.errors";
import { DEFAULT_CONSUMER_ROLE_NAME } from "../../../domain/rbac-catalog";
import type { AuthorizationScope } from "../../authorization-scope";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { AssignDefaultRoleCommand } from "./assign-default-role.command";

/**
 * The role is fixed server-side, so no escalation check applies. Idempotent: an account that already
 * holds the role is left untouched (no audit row, no revocation).
 */
@CommandHandler(AssignDefaultRoleCommand)
export class AssignDefaultRoleHandler implements ICommandHandler<AssignDefaultRoleCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
	) {}

	public async execute(command: AssignDefaultRoleCommand): Promise<void> {
		const { userId } = command;
		await this.rbac.run({ kind: "self_provisioning", userId, actor: command.actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const role: RoleAggregate | null = await scope.roles.findLiveByName(DEFAULT_CONSUMER_ROLE_NAME);
			if (role === null) {
				throw new PlatformRoleNotConfiguredError(DEFAULT_CONSUMER_ROLE_NAME);
			}
			const account: UserAuthorizationAggregate | null = await scope.userAuthorizations.findForAccount(userId);
			if (account === null) {
				throw new RbacTargetUserNotFoundError(userId);
			}
			if (account.hasRole(role.id)) {
				return { kind: "unchanged", result: undefined };
			}
			account.attachProvisioningRole(role.id, userId);
			await scope.userAuthorizations.save(account);
			await this.guard.assertUsersHaveNoConflicts(scope, [userId]);
			return {
				kind: "changed",
				result: undefined,
				audits: [{ action: "ROLE_ASSIGNED_AT_PROVISIONING", targetUserId: userId, targetRoleId: role.id }],
				affectedUserIds: [userId],
			};
		});
	}
}
