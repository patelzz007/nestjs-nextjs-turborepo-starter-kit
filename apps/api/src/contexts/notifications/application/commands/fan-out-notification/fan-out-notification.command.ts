import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Job: turn one notification into its deliveries (ADR 070). */
export class FanOutNotificationCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly notificationId: string },
	) {
		super();
	}
}
