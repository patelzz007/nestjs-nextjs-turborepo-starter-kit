import { Command } from "@nestjs/cqrs";
import type { ImpersonateServiceResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface StartImpersonationInput {
	readonly targetUserId: string;
	readonly mfaAssuredAt: number | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
}

/** A SuperAdmin starts impersonating a user (D36: impersonator row lock; one live session per administrator). */
export class StartImpersonationCommand extends Command<ImpersonateServiceResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: StartImpersonationInput,
	) {
		super();
	}
}
