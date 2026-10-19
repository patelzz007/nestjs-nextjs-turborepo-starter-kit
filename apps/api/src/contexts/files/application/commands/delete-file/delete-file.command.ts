import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /files/:fileId`: soft-delete a file after every owner's reference guard agreed. */
export class DeleteFileCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly fileId: string,
	) {
		super();
	}
}
