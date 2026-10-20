import { Command } from "@nestjs/cqrs";
import type { TenantAccessRequestCreateInput, TenantAccessRequestResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RequestTenantAccessInput extends TenantAccessRequestCreateInput {
	readonly tenantSlug: string;
}

/** A signed-in user asks to join a tenant. */
export class RequestTenantAccessCommand extends Command<TenantAccessRequestResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestTenantAccessInput,
	) {
		super();
	}
}
