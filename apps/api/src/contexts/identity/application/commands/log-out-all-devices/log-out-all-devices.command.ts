import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface LogOutAllDevicesInput {
	readonly userId: string;
}

/** Sign out every device of the user. */
export class LogOutAllDevicesCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LogOutAllDevicesInput,
	) {
		super();
	}
}
