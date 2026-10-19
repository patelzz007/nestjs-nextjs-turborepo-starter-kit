import { Query } from "@nestjs/cqrs";
import type { BackupCodesRemainingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CountRemainingBackupCodesInput {
	readonly userId: string;
}

/** Unused backup codes of the signed-in user. */
export class CountRemainingBackupCodesQuery extends Query<BackupCodesRemainingResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CountRemainingBackupCodesInput,
	) {
		super();
	}
}
