import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { PermissionAggregate, PermissionState } from "../../../domain/aggregates/permission.aggregate";
import { PermissionNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { requireUserActor } from "../../services/rbac-actor";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toAdminPermissionResponse } from "../../services/rbac-response.mapper";
import { RevisePermissionCommand } from "./revise-permission.command";

/** Metadata never changes anyone's access: audited, but no session is revoked. */
@CommandHandler(RevisePermissionCommand)
export class RevisePermissionHandler implements ICommandHandler<RevisePermissionCommand, AdminPermissionResponse> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RevisePermissionCommand): Promise<AdminPermissionResponse> {
		const { permissionId, revision } = command;
		const actor = requireUserActor(command.actor);
		return this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<AdminPermissionResponse>> => {
			const permission: PermissionAggregate | null = await scope.permissions.findLive(permissionId);
			if (permission === null) {
				throw new PermissionNotFoundError(permissionId);
			}
			permission.revise(revision, this.clock.now());
			const stored: PermissionState = await scope.permissions.save(permission);
			return {
				kind: "changed",
				result: toAdminPermissionResponse(stored),
				audits: [{ action: "PERMISSION_UPDATED", permissionId, detail: JSON.stringify(revision) }],
				affectedUserIds: [],
			};
		});
	}
}
