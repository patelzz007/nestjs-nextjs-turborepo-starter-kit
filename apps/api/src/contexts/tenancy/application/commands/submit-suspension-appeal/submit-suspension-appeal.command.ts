import { Command } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SubmitSuspensionAppealInput {
	readonly tenantSlug: string;
	readonly message: string;
}

/** A suspended tenant's owner asks the platform to reinstate it. */
export class SubmitSuspensionAppealCommand extends Command<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SubmitSuspensionAppealInput,
	) {
		super();
	}
}
