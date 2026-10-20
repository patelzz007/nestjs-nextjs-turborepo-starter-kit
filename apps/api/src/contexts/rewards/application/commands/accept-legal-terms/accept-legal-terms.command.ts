import { Command } from "@nestjs/cqrs";
import type { AcceptRewardLegalInput, OkResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /legal/accept`. */
export class AcceptLegalTermsCommand extends Command<OkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AcceptRewardLegalInput,
	) {
		super();
	}
}
