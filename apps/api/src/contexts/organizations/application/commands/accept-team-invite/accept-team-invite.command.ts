import { Command } from "@nestjs/cqrs";
import type { OrganizationTeamInviteAcceptResponse, OrganizationTeamInviteTokenInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface AcceptTeamInviteInput extends OrganizationTeamInviteTokenInput {
	/** The signed-in user's email, from the verified access token. */
	readonly email: string;
}

/** A signed-in user accepts a team invite sent to their address. */
export class AcceptTeamInviteCommand extends Command<OrganizationTeamInviteAcceptResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AcceptTeamInviteInput,
	) {
		super();
	}
}
