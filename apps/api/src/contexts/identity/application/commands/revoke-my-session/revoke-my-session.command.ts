import { Command } from "@nestjs/cqrs";
import type { RevokeSessionResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RevokeMySessionInput {
	readonly sessionId: string;
}

/** Sign out one of the caller's devices from the device list. */
export class RevokeMySessionCommand extends Command<RevokeSessionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RevokeMySessionInput,
	) {
		super();
	}
}
