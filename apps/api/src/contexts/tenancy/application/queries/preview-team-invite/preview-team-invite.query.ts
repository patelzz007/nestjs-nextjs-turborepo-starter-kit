import { Query } from "@nestjs/cqrs";
import type { TenantTeamInvitePreview, TenantTeamInviteTokenInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What a team invite link offers, shown before the invitee signs in or registers. */
export class PreviewTeamInviteQuery extends Query<TenantTeamInvitePreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: TenantTeamInviteTokenInput,
	) {
		super();
	}
}
