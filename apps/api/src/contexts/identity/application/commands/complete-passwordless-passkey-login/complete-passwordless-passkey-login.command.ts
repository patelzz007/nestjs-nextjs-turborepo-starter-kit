import { Command } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse, PasskeyAuthenticationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface CompletePasswordlessPasskeyLoginInput {
	readonly challengeId: string;
	readonly response: PasskeyAuthenticationResponse;
	readonly clientType: string | undefined;
	readonly device: SessionDeviceContext;
}

/** Sign in with a passkey alone: possession of the private key plus user verification (ADR 080). */
export class CompletePasswordlessPasskeyLoginCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompletePasswordlessPasskeyLoginInput,
	) {
		super();
	}
}
