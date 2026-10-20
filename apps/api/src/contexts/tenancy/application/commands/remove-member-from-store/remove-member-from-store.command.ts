import { Command } from "@nestjs/cqrs";
import type { TenantMemberStoreParam, TenantMemberStoreRemoveInput, TenantMemberStoreRemoveResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export type RemoveMemberFromStoreInput = TenantMemberStoreParam & TenantMemberStoreRemoveInput;

/** A team manager takes one store out of a member's scope. */
export class RemoveMemberFromStoreCommand extends Command<TenantMemberStoreRemoveResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RemoveMemberFromStoreInput,
	) {
		super();
	}
}
