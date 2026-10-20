import { Command } from "@nestjs/cqrs";
import type { VerifyEmailResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface VerifyEmailInput {
	readonly token: string;
}

/** Verify an email address with its emailed token (compare-and-set, concurrent verifications answer "already verified"). */
export class VerifyEmailCommand extends Command<VerifyEmailResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: VerifyEmailInput,
	) {
		super();
	}
}
