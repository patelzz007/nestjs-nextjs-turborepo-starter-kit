import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RejectSuspensionAppealInput {
	readonly tenantId: string;
	readonly appealId: string;
	readonly note: string;
}

/** A platform admin rejects a tenant's pending appeal; the tenant stays suspended and may appeal again. */
export class RejectSuspensionAppealCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RejectSuspensionAppealInput,
	) {
		super();
	}
}
