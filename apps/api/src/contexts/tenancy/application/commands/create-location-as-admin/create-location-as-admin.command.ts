import { Command } from "@nestjs/cqrs";
import type { AdminLocationCreateInput, LocationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CreateLocationAsAdminInput extends AdminLocationCreateInput {
	readonly tenantId: string;
}

/** A platform admin adds a store to a merchant, approved at once or left for review. */
export class CreateLocationAsAdminCommand extends Command<LocationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateLocationAsAdminInput,
	) {
		super();
	}
}
