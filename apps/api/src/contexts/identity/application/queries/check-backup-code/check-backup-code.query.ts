import { Query } from "@nestjs/cqrs";
import type { VerifyBackupCodeResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CheckBackupCodeInput {
	readonly userId: string;
	readonly backupCode: string;
}

/** Whether a backup code is valid (does not consume it). */
export class CheckBackupCodeQuery extends Query<VerifyBackupCodeResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CheckBackupCodeInput,
	) {
		super();
	}
}
