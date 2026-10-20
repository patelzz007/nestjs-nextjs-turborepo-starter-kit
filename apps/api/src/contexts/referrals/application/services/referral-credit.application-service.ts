import type { EpochMs } from "@workspace/shared";

import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { SignupReferralSucceeded } from "../../domain/events/referral.events";
import type { RewardReferralRepository, SignupReferralSuccessRepository } from "../../domain/repositories/referral.repositories";
import type { ReferralBonusStockPort, ReferralCreditPort } from "../ports/referral-credit.port";

/**
 * {@link ReferralCreditPort} over the RewardReferral aggregate. The referral is locked first, then the
 * reward's bonus is taken: when there is none, nothing is written and the referral stays PENDING, so a
 * credit never needs undoing.
 */
export class ReferralCreditApplicationService implements ReferralCreditPort {
	public constructor(
		private readonly referrals: RewardReferralRepository,
		private readonly signupReferrals: SignupReferralSuccessRepository,
		private readonly bonusStock: ReferralBonusStockPort,
		private readonly events: TransactionalEventCollector,
	) {}

	public async creditReferrer(rewardId: string, refereeUserId: string, now: EpochMs): Promise<string | null> {
		const referral = await this.referrals.lockPendingFor(rewardId, refereeUserId);
		if (referral === null) {
			return null;
		}
		const bonus = await this.bonusStock.creditReferral(rewardId, now);
		if (bonus === null) {
			return null;
		}
		referral.credit(bonus, now);
		await this.referrals.save(referral);
		this.events.collectFrom(referral);
		return referral.id;
	}

	public async markSignupReferralSuccessful(refereeUserId: string, paidAt: EpochMs): Promise<string | null> {
		const signupReferralId = await this.signupReferrals.markSuccessful(refereeUserId, paidAt);
		if (signupReferralId !== null) {
			this.events.collect(new SignupReferralSucceeded(paidAt, signupReferralId));
		}
		return signupReferralId;
	}
}
