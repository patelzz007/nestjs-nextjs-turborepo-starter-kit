import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { ClaimRedemptionPort } from "../../claims/public-api";
import type { ReferralCreditPort } from "../../referrals/public-api";
import type { CustomerStandingPort, MerchantPosSettingsPort } from "../../tenancy/public-api";
import type { RewardAuditPort, RewardInventoryPort, RewardRedemptionFactsPort } from "../../rewards/public-api";
import type { CodeLockoutRepository, TenantApiKeyRepository, TenantTerminalRepository, RewardSaleRepository } from "../domain/repositories/pos.repositories";
import type { TerminalViewPort } from "./ports/pos-read.port";

/** Everything one pos transaction can touch. Every member is bound to that transaction (plan §5.4). */
export interface PosScope {
	readonly sales: RewardSaleRepository;
	readonly lockout: CodeLockoutRepository;
	readonly terminals: TenantTerminalRepository;
	readonly terminalViews: TerminalViewPort;
	readonly apiKeys: TenantApiKeyRepository;
	/** Tenants' merchant POS policy and till facts. */
	readonly posSettings: MerchantPosSettingsPort;
	/** Tenants' customer bans: a banned customer's codes are refused. */
	readonly customerStanding: CustomerStandingPort;
	/** Claims' merchant-side lookup and redemption. */
	readonly claims: ClaimRedemptionPort;
	/** Rewards' stock (`recordRedemption`), reward facts and audit trail. */
	readonly rewards: RewardInventoryPort;
	readonly rewardFacts: RewardRedemptionFactsPort;
	readonly rewardAudit: RewardAuditPort;
	/** Referrals' referrer credit and signup-referral success stamp. */
	readonly referrals: ReferralCreditPort;
	readonly events: TransactionalEventCollector;
}
