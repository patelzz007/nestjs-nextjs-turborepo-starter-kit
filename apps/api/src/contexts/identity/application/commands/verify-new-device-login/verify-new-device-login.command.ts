import { Command } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface VerifyNewDeviceLoginInput {
	readonly verificationId: string;
	readonly code: string;
	readonly device: SessionDeviceContext;
}

/** Complete a login with the emailed new-device code (D20: atomic attempt counter). */
export class VerifyNewDeviceLoginCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: VerifyNewDeviceLoginInput,
	) {
		super();
	}
}
