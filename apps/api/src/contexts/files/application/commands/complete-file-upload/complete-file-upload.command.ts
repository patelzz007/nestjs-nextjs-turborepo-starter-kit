import { Command } from "@nestjs/cqrs";
import type { CompleteFileUploadInput, CompleteFileUploadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /files/:fileId/complete`: verify the uploaded bytes and claim the file for scanning, exactly once. */
export class CompleteFileUploadCommand extends Command<CompleteFileUploadResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly fileId: string,
		public readonly input: CompleteFileUploadInput,
	) {
		super();
	}
}
