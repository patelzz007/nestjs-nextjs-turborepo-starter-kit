import { Command } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../../domain/value-objects/session-device.value-object";

export interface CompleteBackupCodeLoginInput {
	readonly tempToken: string;
	readonly backupCode: string;
	readonly device: SessionDeviceContext;
}

/** Complete a login with a one-time backup code (the code and the challenge are consumed by compare-and-set). */
export class CompleteBackupCodeLoginCommand extends Command<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompleteBackupCodeLoginInput,
	) {
		super();
	}
}
