import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { RewardCodeHasher } from "../../../../platform/infrastructure/crypto/reward-code-hasher";
import { createClaimsTransactionalPorts } from "../../../claims/public-api";
import { createOrganizationsTransactionalPorts } from "../../../organizations/public-api";
import { createReferralCreditPort } from "../../../referrals/public-api";
import { createRewardsTransactionalPorts } from "../../../rewards/public-api";
import type { PosScope } from "../../application/pos-scope";
import { PrismaCodeLockoutRepository } from "./prisma-code-lockout.repository";
import { PrismaOrganizationApiKeyRepository } from "./prisma-organization-api-key.repository";
import { PrismaOrganizationTerminalRepository } from "./prisma-organization-terminal.repository";
import { PrismaRewardSaleRepository } from "./prisma-reward-sale.repository";
import { PrismaTerminalView } from "./prisma-terminal.view";

/**
 * Builds the pos scope on one transaction: pos's own rows, plus claims' redemption, rewards' stock /
 * facts / audit, referrals' credit and organizations' POS policy, all bound to the same `db` (plan §5.4). Referrals' bonus stock
 * is rewards' inventory on that same transaction.
 */
export class PosScopeFactory implements ScopeFactory<PosScope, Prisma.TransactionClient> {
	public constructor(private readonly codeHasher: RewardCodeHasher) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): PosScope {
		const rewards = createRewardsTransactionalPorts(db);
		return {
			sales: new PrismaRewardSaleRepository(db),
			lockout: new PrismaCodeLockoutRepository(db),
			terminals: new PrismaOrganizationTerminalRepository(db),
			terminalViews: new PrismaTerminalView(db),
			apiKeys: new PrismaOrganizationApiKeyRepository(db),
			posSettings: createOrganizationsTransactionalPorts(db).merchantPosSettings,
			claims: createClaimsTransactionalPorts(db, this.codeHasher, events).redemption,
			rewards: rewards.inventory,
			rewardFacts: rewards.redemptionFacts,
			rewardAudit: rewards.audit,
			referrals: createReferralCreditPort(db, events, rewards.inventory),
			events,
		};
	}
}
