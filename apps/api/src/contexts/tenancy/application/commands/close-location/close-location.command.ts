import { Command } from "@nestjs/cqrs";
import type { LocationCloseInput, LocationCloseResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CloseLocationInput extends LocationCloseInput {
	readonly tenantSlug: string;
	readonly locationId: string;
}

/** Close a store for good (bankruptcy, lease ended), taking away everything that grants access to it. */
export class CloseLocationCommand extends Command<LocationCloseResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CloseLocationInput,
	) {
		super();
	}
}
