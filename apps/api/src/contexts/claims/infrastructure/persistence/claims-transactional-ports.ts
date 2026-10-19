import type { Prisma } from "@prisma/client";

import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { RewardCodeHasher } from "../../../../platform/infrastructure/crypto/reward-code-hasher";
import { createRewardsTransactionalPorts } from "../../../rewards/public-api";
import type { ClaimRedemptionPort } from "../../application/ports/claim-redemption.port";
import { ClaimRedemptionApplicationService } from "../../application/services/claim-redemption.application-service";
import { ClaimCodesAdapter } from "../adapters/claim-codes.adapter";
import { PrismaRewardClaimRepository } from "./prisma-reward-claim.repository";

/** Claims' ports bound to ANOTHER context's transaction (plan §5.4): pos's checkout redeems claims in its own unit of work. */
export interface ClaimsTransactionalPorts {
	readonly redemption: ClaimRedemptionPort;
}

/** Only another context's `infrastructure/` (its scope factory) may call it, with the `db` its unit of work hands it. */
export function createClaimsTransactionalPorts(db: Prisma.TransactionClient, codeHasher: RewardCodeHasher, events: TransactionalEventCollector): ClaimsTransactionalPorts {
	const claims = new PrismaRewardClaimRepository(db);
	return {
		redemption: new ClaimRedemptionApplicationService(claims, claims, createRewardsTransactionalPorts(db).redemptionFacts, new ClaimCodesAdapter(codeHasher), events),
	};
}
