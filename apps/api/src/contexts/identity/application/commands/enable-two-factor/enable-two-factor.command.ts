import { Command } from "@nestjs/cqrs";
import type { TwoFactorMessageResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface EnableTwoFactorInput {
	readonly userId: string;
	readonly token: string;
}

/** Confirm 2FA enrollment (D16: `tokenVersion` moves in the same transaction; cross-instance invalidation after commit). */
export class EnableTwoFactorCommand extends Command<TwoFactorMessageResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: EnableTwoFactorInput,
	) {
		super();
	}
}
