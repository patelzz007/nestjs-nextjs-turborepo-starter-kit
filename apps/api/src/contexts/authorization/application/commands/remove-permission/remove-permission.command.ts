import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Soft-delete a non-system permission. */
export class RemovePermissionCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly permissionId: string,
	) {
		super();
	}
}
