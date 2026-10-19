/*
 * The ONLY file other contexts may import from rewards (plan §6.4).
 *
 * - `RewardsModule` for `app.module.ts`.
 * - `createRewardsTransactionalPorts(db)` (infrastructure only): `RewardInventoryPort`
 *   (reserve / release / recordRedemption on the Reward aggregate), `RewardAuditPort`,
 *   `LegalAcceptanceCheck` and `RewardRedemptionFactsPort`, bound to YOUR transaction.
 * - Review-decision events (mechanism 1 consumers write owner notices in the same transaction).
 * - `RewardsAccessModule` (global leaf) for `app.module.ts`: provides referrals' `SIGNUP_REFERRAL_AUDIT_FACTORY`.
 */
export { RewardsModule } from "./rewards.module";
export { RewardsAccessModule } from "./infrastructure/rewards-access.module";
export { createRewardsTransactionalPorts, type RewardsTransactionalPorts } from "./infrastructure/adapters/rewards-transactional-ports";
export type { ClaimableRewardFacts, ReferrerCreditFacts, RewardInventoryPort } from "./application/ports/reward-inventory.port";
export type {
	LegalAcceptanceCheck,
	RewardAuditEntry,
	RewardAuditPort,
	RewardRedemptionFacts,
	RewardRedemptionFactsPort,
} from "./application/ports/rewards-transactional.ports";
export { RewardApproved, RewardAutoPublished, RewardRejected } from "./domain/events/reward.events";
export { RewardsDomainErrorCodeSchema, type RewardsDomainErrorCode } from "./domain/errors/reward.errors";

// Marketplace list translators: the shared list-query grammar → Prisma (cross-context list-translator spec).
export { buildMarketplaceOrder, buildMarketplaceWhere } from "./infrastructure/persistence/reward-list-queries";
