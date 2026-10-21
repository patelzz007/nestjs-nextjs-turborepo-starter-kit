import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ReinstateTenantInput {
	readonly tenantId: string;
	readonly reason: string;
}

/** A platform admin reinstates a suspended tenant; its pending appeal (if any) is accepted. */
export class ReinstateTenantCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReinstateTenantInput,
	) {
		super();
	}
}
