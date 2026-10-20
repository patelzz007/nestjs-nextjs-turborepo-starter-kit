import { Command } from "@nestjs/cqrs";
import type { StorageDeleteJob } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** BullMQ `storage.delete`: physically delete one stored copy of a soft-deleted file. */
export class PurgeFileObjectCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly job: StorageDeleteJob,
	) {
		super();
	}
}
