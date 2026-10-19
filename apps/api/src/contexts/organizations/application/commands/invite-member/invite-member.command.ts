import { Command } from "@nestjs/cqrs";
import type { OrganizationMemberInviteCreatedResponse, OrganizationMemberInviteInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface InviteMemberInput extends OrganizationMemberInviteInput {
	readonly orgSlug: string;
}

/** A team manager invites someone by email with a role and a store scope. */
export class InviteMemberCommand extends Command<OrganizationMemberInviteCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: InviteMemberInput,
	) {
		super();
	}
}
