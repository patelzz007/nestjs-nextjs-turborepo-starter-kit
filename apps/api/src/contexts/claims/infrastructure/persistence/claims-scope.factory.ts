import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { createIdentityTransactionalPorts } from "../../../identity/public-api";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import { createReferralsTransactionalPorts } from "../../../referrals/public-api";
import { createRewardsTransactionalPorts } from "../../../rewards/public-api";
import { createTenantsTransactionalPorts } from "../../../tenancy/public-api";
import type { ClaimsScope } from "../../application/claims-scope";
import { IdentityClaimantAdapter, ReferralsAttributionAdapter } from "../adapters/claimant.adapter";
import { PrismaClaimView } from "./prisma-claim.view";
import { PrismaOtpChallengeRepository } from "./prisma-otp-challenge.repository";
import { PrismaRewardClaimRepository } from "./prisma-reward-claim.repository";
import { PrismaRewardNotificationInbox } from "./prisma-reward-notification.inbox";
import { newRowId } from "@workspace/shared";

/**
 * Builds the claims scope on one transaction: claims' own rows, plus rewards' inventory / legal / audit,
 * identity's claimant row, referrals' attribution, credit-email and signup-notice bookkeeping, and
 * tenants' customer standing (does the merchant operate, did it ban the customer), all bound to the same `db` (plan §5.4).
 */
export class ClaimsScopeFactory implements ScopeFactory<ClaimsScope, Prisma.TransactionClient> {
	public constructor(private readonly notifications: NotificationsTransactionalPortsFactory) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): ClaimsScope {
		const rewards = createRewardsTransactionalPorts(db);
		const referrals = createReferralsTransactionalPorts(db);
		return {
			claims: new PrismaRewardClaimRepository(db),
			otpChallenges: new PrismaOtpChallengeRepository(db),
			notifications: new PrismaRewardNotificationInbox(db),
			views: new PrismaClaimView(db),
			claimants: new IdentityClaimantAdapter(createIdentityTransactionalPorts(db, { newId: newRowId }, events).consumerClaimants),
			referralAttribution: new ReferralsAttributionAdapter(referrals.rewardReferralAttribution),
			referrerCreditNotices: referrals.referrerCreditNotices,
			signupSuccessNotices: referrals.signupSuccessNotices,
			rewards: rewards.inventory,
			rewardFacts: rewards.redemptionFacts,
			legal: rewards.legal,
			rewardAudit: rewards.audit,
			customerStanding: createTenantsTransactionalPorts(db).customerStanding,
			emails: this.notifications.create(db, events).emailRequests,
			events,
		};
	}
}
