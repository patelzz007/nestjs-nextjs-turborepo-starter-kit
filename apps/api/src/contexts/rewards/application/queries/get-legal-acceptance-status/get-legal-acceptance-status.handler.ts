import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RewardClaimCheckoutStatus } from "@workspace/shared";

import { actingUserId } from "../../commands/acting-user";
import type { LegalAcceptanceReadPort } from "../../ports/reward-read.port";
import { LEGAL_ACCEPTANCE_READS } from "../../ports/rewards.tokens";
import { GetLegalAcceptanceStatusQuery } from "./get-legal-acceptance-status.query";

/** Whether the customer accepted the rewards terms, and the phone they verified (self only). */
@QueryHandler(GetLegalAcceptanceStatusQuery)
export class GetLegalAcceptanceStatusHandler implements IQueryHandler<GetLegalAcceptanceStatusQuery, RewardClaimCheckoutStatus> {
	public constructor(@Inject(LEGAL_ACCEPTANCE_READS) private readonly legal: LegalAcceptanceReadPort) {}

	public async execute(query: GetLegalAcceptanceStatusQuery): Promise<RewardClaimCheckoutStatus> {
		return this.legal.checkoutStatus(query.actor, actingUserId(query.actor));
	}
}
