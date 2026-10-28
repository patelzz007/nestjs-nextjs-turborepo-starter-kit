import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { RoleAggregate, RoleState } from "../../../domain/aggregates/role.aggregate";
import { RoleNameTakenError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toRoleResponse } from "../../services/rbac-response.mapper";
import { ReviseRoleCommand } from "./revise-role.command";

/** Holders of the role are re-authenticated; a re-activation is SoD-checked after the write. */
@CommandHandler(ReviseRoleCommand)
export class ReviseRoleHandler implements ICommandHandler<ReviseRoleCommand, RoleResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviseRoleCommand): Promise<RoleResponse> {
		const { roleId, revision } = command;
		const actor = requireUserActor(command.actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<RoleResponse>> => {
			const role: RoleAggregate = await this.guard.requireMutableRole(scope, rbacActorOf(actor), roleId);
			if (role.isRenamedBy(revision) && revision.name !== undefined && (await scope.roles.isNameTaken(revision.name))) {
				throw new RoleNameTakenError(revision.name, false);
			}
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfRole(roleId);
			role.revise(revision, this.clock.now());
			const stored: RoleState = await scope.roles.save(role);
			await this.guard.assertUsersHaveNoConflicts(scope, affectedUserIds);
			return {
				kind: "changed",
				result: toRoleResponse(stored),
				audits: [{ action: "ROLE_UPDATED", targetRoleId: roleId, detail: JSON.stringify(revision) }],
				affectedUserIds,
			};
		});
	}
}
