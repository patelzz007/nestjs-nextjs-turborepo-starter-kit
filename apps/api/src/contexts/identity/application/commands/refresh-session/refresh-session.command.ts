import { Command } from "@nestjs/cqrs";
import type { RefreshResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface RefreshSessionInput {
	readonly userId: string;
	readonly sessionId: string;
	readonly rawRefreshToken: string;
	readonly device: SessionDeviceContext;
}

/** Rotate a device session's refresh token (compare-and-set; reuse revokes every session in the same transaction). */
export class RefreshSessionCommand extends Command<RefreshResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RefreshSessionInput,
	) {
		super();
	}
}
