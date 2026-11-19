import { Inject, Injectable } from "@nestjs/common";
import type { PaginatedServiceResult, RewardClaimListQuery, RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ClaimNotFoundError } from "../../domain/errors/claims.errors";
import { actingUserId } from "../commands/acting-user";
import type { ClaimReadPort } from "../ports/claims-read.port";
import { CLAIM_READS } from "../ports/claims.tokens";

/** The signed-in customer's own claims (ADR 096): the user id is the scope, never input, and a claim never carries its codes. */
@Injectable()
export class ConsumerClaimsApplicationService {
	public constructor(@Inject(CLAIM_READS) private readonly reads: ClaimReadPort) {}

	/** One page of the caller's claims. */
	public async listMyClaims(actor: ActorContext, input: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		return this.reads.listForUser(actor, actingUserId(actor), input);
	}

	/** One of the caller's own claims; anyone else's (or a missing one) is 404. */
	public async getMyClaim(actor: ActorContext, input: { readonly claimId: string }): Promise<RewardClaimResponse> {
		const claim = await this.reads.findForUser(actor, actingUserId(actor), input.claimId);
		if (claim === null) {
			throw new ClaimNotFoundError(input.claimId);
		}
		return claim;
	}
}
