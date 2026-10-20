import { Command } from "@nestjs/cqrs";
import type { MfaRecoveryStatusResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RequestMfaRecoveryInput {
	readonly userId: string;
	readonly reason: string | undefined;
}

/** Open an admin-reviewed MFA recovery request (per-user advisory lock: one open request). */
export class RequestMfaRecoveryCommand extends Command<MfaRecoveryStatusResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestMfaRecoveryInput,
	) {
		super();
	}
}
