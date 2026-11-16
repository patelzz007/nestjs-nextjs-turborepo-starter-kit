import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Deletes sync runs older than the retention (`DOCS_SYNC_RUN_RETENTION_DAYS`). One bounded DELETE, safe on every instance at once. */
export class PruneDocsSyncRunsCommand extends Command<number> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
