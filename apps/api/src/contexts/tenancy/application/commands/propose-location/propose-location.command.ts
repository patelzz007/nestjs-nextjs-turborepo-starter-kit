import { Command } from "@nestjs/cqrs";
import type { LocationCreateInput, LocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ProposeLocationInput extends LocationCreateInput {
	readonly tenantSlug: string;
}

/** A member with `merchant:manage_locations` requests a new store (it waits for admin review). */
export class ProposeLocationCommand extends Command<LocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ProposeLocationInput,
	) {
		super();
	}
}
