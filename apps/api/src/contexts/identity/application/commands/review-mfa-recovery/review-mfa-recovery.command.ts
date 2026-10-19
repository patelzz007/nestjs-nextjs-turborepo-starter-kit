import { Command } from "@nestjs/cqrs";
import type { MfaRecoveryStatusResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ReviewMfaRecoveryInput {
	readonly reviewerId: string;
	readonly requestId: string;
	readonly decision: "approve" | "deny";
	readonly notes: string | undefined;
}

/** A SuperAdmin approves or denies a recovery request (compare-and-set on PENDING). */
export class ReviewMfaRecoveryCommand extends Command<MfaRecoveryStatusResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviewMfaRecoveryInput,
	) {
		super();
	}
}
