import { Command } from "@nestjs/cqrs";
import type { AdminOrganizationLocationReviewInput, OrganizationLocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ReviewLocationInput extends AdminOrganizationLocationReviewInput {
	readonly organizationId: string;
	readonly locationId: string;
}

/** A platform admin approves or rejects a pending store request. */
export class ReviewLocationCommand extends Command<OrganizationLocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviewLocationInput,
	) {
		super();
	}
}
