import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Hand every scheduled broadcast whose time has come to the sending queue (the minute scheduler, ADR 073). */
export class StartDueBroadcastsCommand extends Command<number> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
