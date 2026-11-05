import { Command } from "@nestjs/cqrs";
import type { Passkey } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RenamePasskeyInput {
	readonly userId: string;
	readonly passkeyId: string;
	readonly name: string;
}

/** Rename one of the caller's passkeys. */
export class RenamePasskeyCommand extends Command<Passkey> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RenamePasskeyInput,
	) {
		super();
	}
}
