import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { RoleAggregate } from "../../../domain/aggregates/role.aggregate";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { RemoveRoleCommand } from "./remove-role.command";

/** Requires holding none of the role and reaching all of it; re-authenticates holders of the role and its descendants. */
@CommandHandler(RemoveRoleCommand)
export class RemoveRoleHandler implements ICommandHandler<RemoveRoleCommand, void> {
	private readonly logger: Logger = new Logger(RemoveRoleHandler.name);

	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemoveRoleCommand): Promise<void> {
		const { roleId } = command;
		const actor = requireUserActor(command.actor);
		const name: string = await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<string>> => {
			const role: RoleAggregate = await this.guard.requireMutableRole(scope, rbacActorOf(actor), roleId);
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfLineage(roleId);
			role.remove(this.clock.now());
			await scope.roles.save(role);
			return { kind: "changed", result: role.name, audits: [{ action: "ROLE_DELETED", targetRoleId: roleId, detail: role.name }], affectedUserIds };
		});
		this.logger.log(`Soft-deleted role "${name}" (${roleId})`);
	}
}
