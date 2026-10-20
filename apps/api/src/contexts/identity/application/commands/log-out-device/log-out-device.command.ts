import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface LogOutDeviceInput {
	readonly userId: string;
	readonly sessionId: string;
}

/** Sign out the device whose refresh token the request presented. Idempotent. */
export class LogOutDeviceCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LogOutDeviceInput,
	) {
		super();
	}
}
