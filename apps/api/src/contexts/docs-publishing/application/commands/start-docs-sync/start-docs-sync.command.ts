import { Command } from "@nestjs/cqrs";
import type { DocsSyncStarted, StartDocsSync } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** An operator starting a sync from the console. */
export class StartDocsSyncCommand extends Command<DocsSyncStarted> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartDocsSync,
	) {
		super();
	}
}
