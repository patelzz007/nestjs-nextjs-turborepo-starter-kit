import { Command } from "@nestjs/cqrs";
import type { MessageResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface UnlockAccountInput {
	readonly userId: string;
}

/** A SuperAdmin clears an account's lockout (D18: attributed write + cross-instance invalidation). */
export class UnlockAccountCommand extends Command<MessageResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: UnlockAccountInput,
	) {
		super();
	}
}
