import { Command } from "@nestjs/cqrs";
import type { OrganizationLocationCreateInput, OrganizationLocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ProposeLocationInput extends OrganizationLocationCreateInput {
	readonly orgSlug: string;
}

/** A member with `merchant:manage_locations` requests a new store (it waits for admin review). */
export class ProposeLocationCommand extends Command<OrganizationLocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ProposeLocationInput,
	) {
		super();
	}
}
