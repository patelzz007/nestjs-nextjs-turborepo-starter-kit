import { Command } from "@nestjs/cqrs";
import type { AdminOrganizationLocationCreateInput, OrganizationLocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CreateLocationAsAdminInput extends AdminOrganizationLocationCreateInput {
	readonly organizationId: string;
}

/** A platform admin adds a store to a merchant, approved at once or left for review. */
export class CreateLocationAsAdminCommand extends Command<OrganizationLocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateLocationAsAdminInput,
	) {
		super();
	}
}
