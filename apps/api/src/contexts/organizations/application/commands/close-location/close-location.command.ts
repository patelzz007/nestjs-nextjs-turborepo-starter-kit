import { Command } from "@nestjs/cqrs";
import type { OrganizationLocationCloseInput, OrganizationLocationCloseResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CloseLocationInput extends OrganizationLocationCloseInput {
	readonly orgSlug: string;
	readonly locationId: string;
}

/** Close a store for good (bankruptcy, lease ended), taking away everything that grants access to it. */
export class CloseLocationCommand extends Command<OrganizationLocationCloseResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CloseLocationInput,
	) {
		super();
	}
}
