import { Command } from "@nestjs/cqrs";
import type { TenantMemberInviteCreatedResponse, TenantMemberInviteInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface InviteMemberInput extends TenantMemberInviteInput {
	readonly tenantSlug: string;
}

/** A team manager invites someone by email with a role and a store scope. */
export class InviteMemberCommand extends Command<TenantMemberInviteCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: InviteMemberInput,
	) {
		super();
	}
}
