import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardClaimResponse } from "@workspace/shared";

import { actingUserId } from "../../commands/acting-user";
import type { ClaimReadPort } from "../../ports/claims-read.port";
import { CLAIM_READS } from "../../ports/claims.tokens";
import { ListMyClaimsQuery } from "./list-my-claims.query";

/** The signed-in customer's own claims, one page at a time (the user id is the scope, never input). */
@QueryHandler(ListMyClaimsQuery)
export class ListMyClaimsHandler implements IQueryHandler<ListMyClaimsQuery, PaginatedServiceResult<RewardClaimResponse>> {
	public constructor(@Inject(CLAIM_READS) private readonly reads: ClaimReadPort) {}

	public async execute(query: ListMyClaimsQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		return this.reads.listForUser(query.actor, actingUserId(query.actor), query.input);
	}
}
