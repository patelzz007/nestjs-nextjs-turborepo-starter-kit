import { Query } from "@nestjs/cqrs";
import type { RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /claims/:claimId` (decision #59): the wallet QR page's server-rendered claim card. */
export interface GetMyClaimInput {
	readonly claimId: string;
}

export class GetMyClaimQuery extends Query<RewardClaimResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetMyClaimInput,
	) {
		super();
	}
}
