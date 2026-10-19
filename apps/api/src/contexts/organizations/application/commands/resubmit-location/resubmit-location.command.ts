import { Command } from "@nestjs/cqrs";
import type { OrganizationLocationResponse, OrganizationLocationUpdateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ResubmitLocationInput extends OrganizationLocationUpdateInput {
	readonly orgSlug: string;
	readonly locationId: string;
}

/** A rejected store request is corrected and sent back for review. */
export class ResubmitLocationCommand extends Command<OrganizationLocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ResubmitLocationInput,
	) {
		super();
	}
}
