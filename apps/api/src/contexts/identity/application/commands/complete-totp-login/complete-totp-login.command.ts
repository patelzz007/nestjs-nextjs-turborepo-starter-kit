import { Command } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface CompleteTotpLoginInput {
	readonly tempToken: string;
	readonly token: string;
	readonly device: SessionDeviceContext;
}

/** Complete a login with a TOTP code (D13: the challenge and the TOTP step are consumed by compare-and-set). */
export class CompleteTotpLoginCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompleteTotpLoginInput,
	) {
		super();
	}
}
