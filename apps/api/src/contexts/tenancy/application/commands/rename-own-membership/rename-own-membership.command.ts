import { Command } from "@nestjs/cqrs";
import type { MembershipResponse, TenantOwnMembershipUpdateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RenameOwnMembershipInput extends TenantOwnMembershipUpdateInput {
	readonly tenantSlug: string;
}

/** The signed-in member sets (or with `null` clears) their display name in this tenant. */
export class RenameOwnMembershipCommand extends Command<MembershipResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RenameOwnMembershipInput,
	) {
		super();
	}
}
