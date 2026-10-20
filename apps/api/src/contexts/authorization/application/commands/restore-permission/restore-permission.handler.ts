import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { PermissionAggregate, PermissionState } from "../../../domain/aggregates/permission.aggregate";
import { DeletedPermissionNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { rbacActorOf, requireUserActor } from "../../services/rbac-actor";
import { RbacMutationGuard } from "../../services/rbac-mutation-guard";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toAdminPermissionResponse } from "../../services/rbac-response.mapper";
import { RestorePermissionCommand } from "./restore-permission.command";

/** Every role and user still assigned the permission regains it, so the actor must hold it. */
@CommandHandler(RestorePermissionCommand)
export class RestorePermissionHandler implements ICommandHandler<RestorePermissionCommand, AdminPermissionResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		private readonly guard: RbacMutationGuard,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RestorePermissionCommand): Promise<AdminPermissionResponse> {
		const { permissionId } = command;
		const actor = requireUserActor(command.actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<AdminPermissionResponse>> => {
			const permission: PermissionAggregate | null = await scope.permissions.findIncludingDeleted(permissionId);
			if (!permission?.isDeleted) {
				throw new DeletedPermissionNotFoundError(permissionId);
			}
			await this.guard.assertHoldsPairs(rbacActorOf(actor), [permission.pair]);
			permission.restore(this.clock.now());
			const stored: PermissionState = await scope.permissions.save(permission);
			const affectedUserIds: string[] = await scope.rbacGraph.holdersOfPermission(permissionId);
			return {
				kind: "changed",
				result: toAdminPermissionResponse(stored),
				audits: [{ action: "PERMISSION_RESTORED", permissionId, detail: permission.key }],
				affectedUserIds,
			};
		});
	}
}
