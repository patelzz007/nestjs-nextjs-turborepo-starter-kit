import { Command } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PermissionRevision } from "../../../domain/aggregates/permission.aggregate";

/** Edit a non-system permission's metadata (description / group). */
export class RevisePermissionCommand extends Command<AdminPermissionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly permissionId: string,
		public readonly revision: PermissionRevision,
	) {
		super();
	}
}
