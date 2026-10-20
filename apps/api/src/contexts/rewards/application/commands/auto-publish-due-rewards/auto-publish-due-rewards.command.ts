import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** How one run went: rewards published, and due rewards skipped because they moved on first (D10). */
export interface AutoPublishDueRewardsResult {
	readonly published: number;
	readonly skipped: number;
}

/** Publish every pending reward whose review window has elapsed (BullMQ `rewardsAutoPublish`). */
export class AutoPublishDueRewardsCommand extends Command<AutoPublishDueRewardsResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
