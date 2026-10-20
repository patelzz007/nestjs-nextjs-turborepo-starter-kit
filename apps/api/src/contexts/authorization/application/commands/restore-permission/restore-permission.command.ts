import { Command } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Restore a soft-deleted permission. */
export class RestorePermissionCommand extends Command<AdminPermissionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly permissionId: string,
	) {
		super();
	}
}
