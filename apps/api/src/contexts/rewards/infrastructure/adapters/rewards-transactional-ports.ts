import type { Prisma } from "@prisma/client";

import type { RewardInventoryPort } from "../../application/ports/reward-inventory.port";
import type { LegalAcceptanceCheck, RewardAuditPort, RewardRedemptionFactsPort } from "../../application/ports/rewards-transactional.ports";
import { RewardInventoryApplicationService } from "../../application/services/reward-inventory.application-service";
import { PrismaLegalAcceptanceCheck, PrismaRewardAuditWriter, PrismaRewardRedemptionFacts } from "../persistence/prisma-reward-transactional.adapters";
import { PrismaRewardRepository } from "../persistence/prisma-reward.repository";

/** What other contexts may do to rewards inside THEIR transaction (claims, pos, referrals). */
export interface RewardsTransactionalPorts {
	readonly inventory: RewardInventoryPort;
	readonly audit: RewardAuditPort;
	readonly legal: LegalAcceptanceCheck;
	readonly redemptionFacts: RewardRedemptionFactsPort;
}

/**
 * Transactional port factory (plan §5.4): the consumer's scope factory calls it with its own
 * transaction client, so the reward stock change and the consumer's rows share one transaction.
 * Only another context's `infrastructure/` may call it.
 */
export function createRewardsTransactionalPorts(db: Prisma.TransactionClient): RewardsTransactionalPorts {
	return {
		inventory: new RewardInventoryApplicationService(new PrismaRewardRepository(db)),
		audit: new PrismaRewardAuditWriter(db),
		legal: new PrismaLegalAcceptanceCheck(db),
		redemptionFacts: new PrismaRewardRedemptionFacts(db),
	};
}
