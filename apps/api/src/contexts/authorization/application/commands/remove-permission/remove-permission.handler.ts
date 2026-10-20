import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { PermissionAggregate } from "../../../domain/aggregates/permission.aggregate";
import { PermissionNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { RemovePermissionCommand } from "./remove-permission.command";

/** The permission disappears from every holder, so the actor must hold it; every holder is re-authenticated. */
@CommandHandler(RemovePermissionCommand)
export class RemovePermissionHandler implements ICommandHandler<RemovePermissionCommand, void> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemovePermissionCommand): Promise<void> {
		const { permissionId } = command;
		const actor = requireUserActor(command.actor);
		await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<void>> => {
			const permission: PermissionAggregate | null = await scope.permissions.findLive(permissionId);
			if (permission === null) {
				throw new PermissionNotFoundError(permissionId);
			}
			permission.assertMutable();
			await this.guard.assertHoldsPairs(rbacActorOf(actor), [permission.pair]);
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfPermission(permissionId);
			permission.remove(this.clock.now());
			await scope.permissions.save(permission);
			return { kind: "changed", result: undefined, audits: [{ action: "PERMISSION_DELETED", permissionId, detail: permission.key }], affectedUserIds };
		});
	}
}
