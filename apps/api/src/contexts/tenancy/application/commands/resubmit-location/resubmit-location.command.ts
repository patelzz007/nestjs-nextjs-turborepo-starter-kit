import { Command } from "@nestjs/cqrs";
import type { LocationResponse, LocationUpdateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ResubmitLocationInput extends LocationUpdateInput {
	readonly tenantSlug: string;
	readonly locationId: string;
}

/** A rejected store request is corrected and sent back for review. */
export class ResubmitLocationCommand extends Command<LocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ResubmitLocationInput,
	) {
		super();
	}
}
