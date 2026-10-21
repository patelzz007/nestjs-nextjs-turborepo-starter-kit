import { Command } from "@nestjs/cqrs";
import type { TenantMembershipLeaveResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface LeaveTenantInput {
	readonly tenantSlug: string;
}

/** The signed-in member leaves the tenant, whatever their membership's status. */
export class LeaveTenantCommand extends Command<TenantMembershipLeaveResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LeaveTenantInput,
	) {
		super();
	}
}
