import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SuspendTenantInput {
	readonly tenantId: string;
	readonly reason: string;
}

/** A platform admin suspends an active or restricted tenant. */
export class SuspendTenantCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SuspendTenantInput,
	) {
		super();
	}
}
