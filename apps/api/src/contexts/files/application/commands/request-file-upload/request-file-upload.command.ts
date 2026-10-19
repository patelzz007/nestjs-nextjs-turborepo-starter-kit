import { Command } from "@nestjs/cqrs";
import type { CreateFileUploadUrlInput, CreateFileUploadUrlResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /files/upload-url`: create a PENDING file and its browser upload ticket. */
export class RequestFileUploadCommand extends Command<CreateFileUploadUrlResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateFileUploadUrlInput,
	) {
		super();
	}
}
