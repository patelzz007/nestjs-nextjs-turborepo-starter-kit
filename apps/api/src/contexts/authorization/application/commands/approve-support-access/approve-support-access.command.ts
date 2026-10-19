import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** An active owner of the grant's organization approves a pending grant. */
export class ApproveSupportAccessCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly grantId: string,
	) {
		super();
	}
}
