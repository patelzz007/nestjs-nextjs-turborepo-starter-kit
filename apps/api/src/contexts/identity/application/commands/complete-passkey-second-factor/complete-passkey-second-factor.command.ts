import { Command } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse, PasskeyAuthenticationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface CompletePasskeySecondFactorInput {
	readonly tempToken: string;
	readonly challengeId: string;
	readonly response: PasskeyAuthenticationResponse;
	readonly device: SessionDeviceContext;
}

/** Complete a password sign-in with a passkey instead of a TOTP or backup code (D13: the login challenge is consumed by compare-and-set). */
export class CompletePasskeySecondFactorCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompletePasskeySecondFactorInput,
	) {
		super();
	}
}
