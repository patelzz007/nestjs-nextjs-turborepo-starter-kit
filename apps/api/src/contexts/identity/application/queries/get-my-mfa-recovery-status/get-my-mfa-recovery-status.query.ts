import { Query } from "@nestjs/cqrs";
import type { MfaRecoveryStatusResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetMyMfaRecoveryStatusInput {
	readonly userId: string;
}

/** The caller's latest MFA recovery request. */
export class GetMyMfaRecoveryStatusQuery extends Query<MfaRecoveryStatusResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetMyMfaRecoveryStatusInput,
	) {
		super();
	}
}
