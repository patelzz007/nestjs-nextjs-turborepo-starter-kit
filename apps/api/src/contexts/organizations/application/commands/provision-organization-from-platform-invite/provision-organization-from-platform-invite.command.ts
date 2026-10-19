import { Command } from "@nestjs/cqrs";
import type { AdminCreateOrganizationInviteInput, AdminOrganizationInviteCreatedResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A super-admin provisions an organization and its onboarding invite. */
export class ProvisionOrganizationFromPlatformInviteCommand extends Command<AdminOrganizationInviteCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminCreateOrganizationInviteInput,
	) {
		super();
	}
}
