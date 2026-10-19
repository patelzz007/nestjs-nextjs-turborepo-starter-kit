import { Command } from "@nestjs/cqrs";
import type { LoginInput, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginTwoFactorPendingResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface LogInInput {
	readonly body: LoginInput;
	readonly clientType: string | undefined;
	readonly device: SessionDeviceContext;
}

/** The password step of a login (D19: atomic lockout counting). */
export class LogInCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LogInInput,
	) {
		super();
	}
}
