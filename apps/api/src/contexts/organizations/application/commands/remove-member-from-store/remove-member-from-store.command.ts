import { Command } from "@nestjs/cqrs";
import type { OrganizationMemberStoreParam, OrganizationMemberStoreRemoveInput, OrganizationMemberStoreRemoveResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export type RemoveMemberFromStoreInput = OrganizationMemberStoreParam & OrganizationMemberStoreRemoveInput;

/** A team manager takes one store out of a member's scope. */
export class RemoveMemberFromStoreCommand extends Command<OrganizationMemberStoreRemoveResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RemoveMemberFromStoreInput,
	) {
		super();
	}
}
