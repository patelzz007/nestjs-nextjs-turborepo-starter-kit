import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { VerdictOutcome } from "../../ports/file-processing.port";

/** BullMQ `storage.scan`: scan one file and apply its verdict. */
export class ScanFileCommand extends Command<VerdictOutcome> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly fileId: string,
		/** The last attempt BullMQ will make: a scanner outage now fails the upload instead of retrying. */
		public readonly finalAttempt: boolean,
	) {
		super();
	}
}
