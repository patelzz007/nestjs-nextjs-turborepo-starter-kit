import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Soft-delete a non-system role. */
export class RemoveRoleCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly roleId: string,
	) {
		super();
	}
}
