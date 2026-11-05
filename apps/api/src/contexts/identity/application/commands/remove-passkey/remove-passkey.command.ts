import { Command } from "@nestjs/cqrs";
import type { PasskeyMessageResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RemovePasskeyInput {
	readonly userId: string;
	readonly passkeyId: string;
}

/** Remove one of the caller's passkeys (soft delete): it can no longer sign in. */
export class RemovePasskeyCommand extends Command<PasskeyMessageResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RemovePasskeyInput,
	) {
		super();
	}
}
