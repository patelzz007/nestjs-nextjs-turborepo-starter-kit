import { Command } from "@nestjs/cqrs";
import type { StorageCdnInvalidationJob } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** BullMQ `storage.cdn-invalidate`: purge a withdrawn file's keys from the CDN. */
export class InvalidateFileCdnCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly job: StorageCdnInvalidationJob,
	) {
		super();
	}
}
