import type { EpochMs } from "@workspace/shared";

import type { ConsumerClaimantPort } from "../../../identity/public-api";
import type { ReferralAttributionPort, ClaimantPort, ClaimantProfile } from "../../application/ports/claims-transactional.ports";
import type { RewardReferralAttributionPort } from "../../../referrals/public-api";

/** Claims' view of the claimant, over identity's `ConsumerClaimantPort` (identity owns the account row). */
export class IdentityClaimantAdapter implements ClaimantPort {
	public constructor(private readonly claimants: ConsumerClaimantPort) {}

	public profile(userId: string): Promise<ClaimantProfile | null> {
		return this.claimants.findClaimant(userId, { lock: false });
	}

	public lockForClaim(userId: string): Promise<ClaimantProfile | null> {
		return this.claimants.findClaimant(userId, { lock: true });
	}

	public displayName(userId: string): Promise<string | null> {
		return this.claimants.displayName(userId);
	}

	public recordVerifiedPhone(userId: string, phone: string, now: EpochMs): Promise<void> {
		return this.claimants.markPhoneVerified(userId, phone, now);
	}
}

/** Claims' referral attribution, over referrals' `RewardReferralAttributionPort` (referrals owns the referral row). */
export class ReferralsAttributionAdapter implements ReferralAttributionPort {
	public constructor(private readonly referrals: RewardReferralAttributionPort) {}

	public attach(attributionToken: string, rewardId: string, refereeUserId: string): Promise<string | null> {
		return this.referrals.attachReferee(attributionToken, rewardId, refereeUserId);
	}
}
