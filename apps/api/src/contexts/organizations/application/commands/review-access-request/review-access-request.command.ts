import { Command } from "@nestjs/cqrs";
import type { OrganizationAccessRequestParam, ReviewOrganizationAccessRequestInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export type ReviewAccessRequestInput = OrganizationAccessRequestParam & ReviewOrganizationAccessRequestInput;

/** A team manager approves (granting a membership) or rejects a pending access request. */
export class ReviewAccessRequestCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviewAccessRequestInput,
	) {
		super();
	}
}
