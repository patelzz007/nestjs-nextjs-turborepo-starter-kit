import { Command } from "@nestjs/cqrs";
import type { StopImpersonationServiceResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StopImpersonationInput {
	readonly impersonatorId: string;
	readonly targetUserId: string;
	readonly impersonationSessionId: string;
	/** The administrator's own refresh token (cookie or mobile body): it names the device session the restored token binds to. */
	readonly presentedRefreshToken: string;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
}

/** Stop impersonating and restore the administrator's own access token. */
export class StopImpersonationCommand extends Command<StopImpersonationServiceResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StopImpersonationInput,
	) {
		super();
	}
}
