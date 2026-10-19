import { Command } from "@nestjs/cqrs";
import type { RewardClaimQrResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /claims/:claimId/qr` (D07): a command — it rotates the stored code hashes. */
export interface IssueClaimQrCodesInput {
	readonly claimId: string;
}

export class IssueClaimQrCodesCommand extends Command<RewardClaimQrResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: IssueClaimQrCodesInput,
	) {
		super();
	}
}
