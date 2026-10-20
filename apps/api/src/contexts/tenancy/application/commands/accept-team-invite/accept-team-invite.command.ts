import { Command } from "@nestjs/cqrs";
import type { TenantTeamInviteAcceptResponse, TenantTeamInviteTokenInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface AcceptTeamInviteInput extends TenantTeamInviteTokenInput {
	/** The signed-in user's email, from the verified access token. */
	readonly email: string;
}

/** A signed-in user accepts a team invite sent to their address. */
export class AcceptTeamInviteCommand extends Command<TenantTeamInviteAcceptResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AcceptTeamInviteInput,
	) {
		super();
	}
}
