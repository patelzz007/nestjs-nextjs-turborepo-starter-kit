import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface UnbanTenantInput {
	readonly tenantId: string;
	readonly reason: string;
}

/** A super admin lifts a tenant's ban. */
export class UnbanTenantCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: UnbanTenantInput,
	) {
		super();
	}
}
