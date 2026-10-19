import { Command } from "@nestjs/cqrs";
import type { OrganizationAccessRequestCreateInput, OrganizationAccessRequestResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RequestOrganizationAccessInput extends OrganizationAccessRequestCreateInput {
	readonly orgSlug: string;
}

/** A signed-in user asks to join an organization. */
export class RequestOrganizationAccessCommand extends Command<OrganizationAccessRequestResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestOrganizationAccessInput,
	) {
		super();
	}
}
