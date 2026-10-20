import { Command } from "@nestjs/cqrs";
import type { TwoFactorSetupResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RotateTwoFactorInput {
	readonly userId: string;
	readonly password: string;
	readonly token: string | undefined;
	readonly backupCode: string | undefined;
}

/** Re-enroll 2FA after proving the password and a current factor (D16, D17: one transaction, the backup code is consumed). */
export class RotateTwoFactorCommand extends Command<TwoFactorSetupResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RotateTwoFactorInput,
	) {
		super();
	}
}
