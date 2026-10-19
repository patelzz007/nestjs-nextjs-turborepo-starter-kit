import { Query } from "@nestjs/cqrs";
import type { OrganizationTeamInvitePreview, OrganizationTeamInviteTokenInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What a team invite link offers, shown before the invitee signs in or registers. */
export class PreviewTeamInviteQuery extends Query<OrganizationTeamInvitePreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: OrganizationTeamInviteTokenInput,
	) {
		super();
	}
}
