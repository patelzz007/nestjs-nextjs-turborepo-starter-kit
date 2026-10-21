import { Command } from "@nestjs/cqrs";
import type { TenantMemberLocationParam, TenantMemberLocationRemoveInput, TenantMemberLocationRemoveResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export type RemoveMemberFromLocationInput = TenantMemberLocationParam & TenantMemberLocationRemoveInput;

/** A team manager takes one store out of a member's scope. */
export class RemoveMemberFromLocationCommand extends Command<TenantMemberLocationRemoveResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RemoveMemberFromLocationInput,
	) {
		super();
	}
}
