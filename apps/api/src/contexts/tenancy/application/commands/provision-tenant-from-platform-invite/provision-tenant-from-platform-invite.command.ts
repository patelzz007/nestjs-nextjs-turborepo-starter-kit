import { Command } from "@nestjs/cqrs";
import type { AdminCreateTenantInviteInput, AdminTenantInviteCreatedResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A super-admin provisions a tenant and its onboarding invite. */
export class ProvisionTenantFromPlatformInviteCommand extends Command<AdminTenantInviteCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminCreateTenantInviteInput,
	) {
		super();
	}
}
