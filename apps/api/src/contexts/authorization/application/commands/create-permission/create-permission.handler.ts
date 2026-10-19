import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { PermissionAggregate, type PermissionState } from "../../../domain/aggregates/permission.aggregate";
import { PermissionAlreadyExistsError } from "../../../domain/errors/authorization.errors";
import { permissionKeyOf } from "../../../domain/rbac-catalog";
import type { AuthorizationScope } from "../../authorization-scope";
import { requireUserActor } from "../../services/rbac-actor";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toAdminPermissionResponse } from "../../services/rbac-response.mapper";
import { CreatePermissionCommand } from "./create-permission.command";
import { newRowId } from "@workspace/shared";

/** Nobody holds a new permission yet, so no session is affected: the row and its audit row commit together. */
@CommandHandler(CreatePermissionCommand)
export class CreatePermissionHandler implements ICommandHandler<CreatePermissionCommand, AdminPermissionResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreatePermissionCommand): Promise<AdminPermissionResponse> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<AdminPermissionResponse>> => {
			if (await scope.permissions.existsForPair(input)) {
				throw new PermissionAlreadyExistsError(permissionKeyOf(input));
			}
			const permission: PermissionAggregate = PermissionAggregate.create(
				{ id: newRowId(), action: input.action, resource: input.resource, description: input.description ?? null, group: input.group ?? null },
				this.clock.now(),
			);
			const stored: PermissionState = await scope.permissions.save(permission);
			return {
				kind: "changed",
				result: toAdminPermissionResponse(stored),
				audits: [{ action: "PERMISSION_CREATED", permissionId: stored.id, detail: JSON.stringify(input) }],
				affectedUserIds: [],
			};
		});
	}
}
