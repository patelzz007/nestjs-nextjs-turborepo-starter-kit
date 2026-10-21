import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { EmailRequestTransactionalPort } from "../../notifications/public-api";
import type { ReferrerCreditNoticesPort, SignupSuccessNoticesPort } from "../../referrals/public-api";
import type { LegalAcceptanceCheck, RewardAuditPort, RewardInventoryPort, RewardRedemptionFactsPort } from "../../rewards/public-api";
import type { CustomerStandingPort } from "../../tenancy/public-api";
import type { OtpChallengeRepository, RewardClaimRepository } from "../domain/repositories/claims.repositories";
import type { ClaimantPort, ClaimViewPort, ReferralAttributionPort, RewardNotificationInbox } from "./ports/claims-transactional.ports";

/** Everything one claims transaction can touch. Every member is bound to that transaction. */
export interface ClaimsScope {
	readonly claims: RewardClaimRepository;
	readonly otpChallenges: OtpChallengeRepository;
	readonly notifications: RewardNotificationInbox;
	readonly views: ClaimViewPort;
	readonly claimants: ClaimantPort;
	readonly referralAttribution: ReferralAttributionPort;
	/** Referrals' referrer-credit email bookkeeping (`creditNotifiedAt`), in this same transaction. */
	readonly referrerCreditNotices: ReferrerCreditNoticesPort;
	/** Referrals' signup-success notice bookkeeping (`successNotifiedAt`), in this same transaction. */
	readonly signupSuccessNotices: SignupSuccessNoticesPort;
	/** Rewards' stock, legal acceptance and audit trail, in this same transaction. */
	readonly rewards: RewardInventoryPort;
	readonly rewardFacts: RewardRedemptionFactsPort;
	readonly legal: LegalAcceptanceCheck;
	readonly rewardAudit: RewardAuditPort;
	/** Tenants' answer to "may this customer take this merchant's rewards", in this same transaction. */
	readonly customerStanding: CustomerStandingPort;
	readonly emails: EmailRequestTransactionalPort;
	readonly events: TransactionalEventCollector;
}
