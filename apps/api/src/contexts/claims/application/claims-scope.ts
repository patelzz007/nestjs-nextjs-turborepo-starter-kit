import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { EmailRequestTransactionalPort, LegacyInboxImportPort, NotifyTransactionalPort } from "../../notifications/public-api";
import type { ReferrerCreditNoticesPort, SignupSuccessNoticesPort } from "../../referrals/public-api";
import type { LegalAcceptanceCheck, RewardAuditPort, RewardInventoryPort, RewardRedemptionFactsPort } from "../../rewards/public-api";
import type { CustomerStandingPort, TenantCustomerLinksPort, ReviewNoticeFactsPort } from "../../tenancy/public-api";
import type { OtpChallengeRepository, RewardClaimRepository } from "../domain/repositories/claims.repositories";
import type { ClaimantPort, ClaimViewPort, LegacyRewardNoticeStore, ReferralAttributionPort } from "./ports/claims-transactional.ports";

/** Everything one claims transaction can touch. Every member is bound to that transaction. */
export interface ClaimsScope {
	readonly claims: RewardClaimRepository;
	readonly otpChallenges: OtpChallengeRepository;
	/** `notify()` (ADR 070): every notice claims sends, in this same transaction. */
	readonly notify: NotifyTransactionalPort;
	/** The earlier reward inbox, read only to move it (ADR 070). */
	readonly legacyNotices: LegacyRewardNoticeStore;
	/** Notifications' side of that move, in this same transaction. */
	readonly legacyInbox: LegacyInboxImportPort;
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
	/** Tenants' tenant-customer links (ADR 073), in this same transaction. */
	readonly tenantCustomers: TenantCustomerLinksPort;
	/** Tenants' slug and owners for a review notice, in this same transaction. */
	readonly tenantReviewNotices: ReviewNoticeFactsPort;
	readonly emails: EmailRequestTransactionalPort;
	readonly events: TransactionalEventCollector;
}
