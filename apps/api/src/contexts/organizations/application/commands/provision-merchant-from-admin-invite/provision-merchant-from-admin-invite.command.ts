import { Command } from "@nestjs/cqrs";
import type { AdminCreateMerchantInviteInput, EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface MerchantInviteCreated {
	readonly inviteId: string;
	readonly inviteToken: string;
	readonly expiresAt: EpochMs;
}

/** A platform admin invites a merchant: the organization is pre-provisioned and the owner invite emailed. */
export class ProvisionMerchantFromAdminInviteCommand extends Command<MerchantInviteCreated> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminCreateMerchantInviteInput,
	) {
		super();
	}
}
