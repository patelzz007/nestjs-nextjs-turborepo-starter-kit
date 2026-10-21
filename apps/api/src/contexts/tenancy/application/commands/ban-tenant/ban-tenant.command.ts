import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface BanTenantInput {
	readonly tenantId: string;
	readonly reason: string;
}

/** A super admin bans an active, restricted or suspended tenant. */
export class BanTenantCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: BanTenantInput,
	) {
		super();
	}
}
