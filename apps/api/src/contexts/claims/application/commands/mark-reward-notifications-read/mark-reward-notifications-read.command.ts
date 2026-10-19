import { Command } from "@nestjs/cqrs";
import type { MarkRewardNotificationsReadInput, OkResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /reward-notifications/read`. */
export class MarkRewardNotificationsReadCommand extends Command<OkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MarkRewardNotificationsReadInput,
	) {
		super();
	}
}
