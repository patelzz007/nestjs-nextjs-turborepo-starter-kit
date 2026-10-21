import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ReactivateTenantInput {
	readonly tenantSlug: string;
}

/** The owner cancels the tenant's pending deletion while its grace period runs. */
export class ReactivateTenantCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReactivateTenantInput,
	) {
		super();
	}
}
