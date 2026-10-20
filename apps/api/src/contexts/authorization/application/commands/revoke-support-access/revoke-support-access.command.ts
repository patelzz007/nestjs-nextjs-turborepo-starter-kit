import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A SuperAdmin revokes a pending or active grant. */
export class RevokeSupportAccessCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly grantId: string,
	) {
		super();
	}
}
