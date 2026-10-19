import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What one sweep did. Failures are logged per file and left for the next sweep. */
export interface StaleUploadSweepSummary {
	readonly abandonedDeleted: number;
	readonly expiredStagingDeleted: number;
	readonly scansRedispatched: number;
	readonly failures: number;
}

/** BullMQ `storage.cleanup` (hourly): remove abandoned and expired uploads, re-dispatch overdue scans. */
export class CleanUpStaleUploadsCommand extends Command<StaleUploadSweepSummary> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
