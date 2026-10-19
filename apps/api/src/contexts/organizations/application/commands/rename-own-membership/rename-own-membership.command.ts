import { Command } from "@nestjs/cqrs";
import type { OrganizationMembershipResponse, OrganizationOwnMembershipUpdateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RenameOwnMembershipInput extends OrganizationOwnMembershipUpdateInput {
	readonly orgSlug: string;
}

/** The signed-in member sets (or with `null` clears) their display name in this organization. */
export class RenameOwnMembershipCommand extends Command<OrganizationMembershipResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RenameOwnMembershipInput,
	) {
		super();
	}
}
