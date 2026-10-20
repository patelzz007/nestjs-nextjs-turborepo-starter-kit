import { Command } from "@nestjs/cqrs";
import type { FileProcessingResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /files/processing-callback`: an external worker's verdict (authenticated by its shared secret). */
export class ApplyFileProcessingResultCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		/** The `x-storage-callback-secret` header as sent; null when absent. */
		public readonly callbackSecret: string | null,
		public readonly input: FileProcessingResult,
	) {
		super();
	}
}
