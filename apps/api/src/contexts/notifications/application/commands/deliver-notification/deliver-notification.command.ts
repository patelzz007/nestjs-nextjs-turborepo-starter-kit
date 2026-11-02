import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Job: send one push or SMS delivery (ADR 070). */
export class DeliverNotificationCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly channel: "PUSH" | "SMS"; readonly deliveryId: string },
	) {
		super();
	}
}
