import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Start sending one scheduled broadcast (the `broadcasts.send` worker, ADR 073). */
export class SendBroadcastCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly broadcastId: string },
	) {
		super();
	}
}
