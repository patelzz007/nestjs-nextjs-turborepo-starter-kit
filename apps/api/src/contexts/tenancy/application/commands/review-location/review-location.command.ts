import { Command } from "@nestjs/cqrs";
import type { AdminLocationReviewInput, LocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ReviewLocationInput extends AdminLocationReviewInput {
	readonly tenantId: string;
	readonly locationId: string;
}

/** A platform admin approves or rejects a pending store request. */
export class ReviewLocationCommand extends Command<LocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviewLocationInput,
	) {
		super();
	}
}
