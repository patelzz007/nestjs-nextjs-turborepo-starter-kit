import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RewardClaimResponse } from "@workspace/shared";

import { ClaimNotFoundError } from "../../../domain/errors/claims.errors";
import { actingUserId } from "../../commands/acting-user";
import type { ClaimReadPort } from "../../ports/claims-read.port";
import { CLAIM_READS } from "../../ports/claims.tokens";
import { GetMyClaimQuery } from "./get-my-claim.query";

/** One of the caller's own claims; anyone else's (or a missing one) is 404. It never carries the codes. */
@QueryHandler(GetMyClaimQuery)
export class GetMyClaimHandler implements IQueryHandler<GetMyClaimQuery, RewardClaimResponse> {
	public constructor(@Inject(CLAIM_READS) private readonly reads: ClaimReadPort) {}

	public async execute(query: GetMyClaimQuery): Promise<RewardClaimResponse> {
		const claim = await this.reads.findForUser(query.actor, actingUserId(query.actor), query.input.claimId);
		if (claim === null) {
			throw new ClaimNotFoundError(query.input.claimId);
		}
		return claim;
	}
}
