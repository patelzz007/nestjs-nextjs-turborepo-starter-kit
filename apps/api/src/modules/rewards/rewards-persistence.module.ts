import { Module, type Provider } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { MerchantApiKeyRepository } from "./repositories/merchant-api-key.repository";
import { MerchantTerminalRepository } from "./repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "./repositories/reward-audit-log.repository";
import { RewardClaimRepository } from "./repositories/reward-claim.repository";
import { RewardLegalAcceptanceRepository } from "./repositories/reward-legal-acceptance.repository";
import { RewardNotificationRepository } from "./repositories/reward-notification.repository";
import { RewardOtpChallengeRepository } from "./repositories/reward-otp-challenge.repository";
import { RewardRedemptionRepository } from "./repositories/reward-redemption.repository";
import { RewardReferralRepository } from "./repositories/reward-referral.repository";
import { RewardRepository } from "./repositories/reward.repository";
import { RewardSaleRepository } from "./repositories/reward-sale.repository";
import { RewardUserRepository } from "./repositories/reward-user.repository";

const REWARD_REPOSITORIES: readonly Provider[] = [
	RewardRepository,
	RewardClaimRepository,
	RewardRedemptionRepository,
	RewardSaleRepository,
	RewardReferralRepository,
	RewardAuditLogRepository,
	RewardLegalAcceptanceRepository,
	RewardNotificationRepository,
	RewardOtpChallengeRepository,
	RewardUserRepository,
	MerchantApiKeyRepository,
	MerchantTerminalRepository,
];

@Module({
	imports: [PrismaModule],
	providers: [...REWARD_REPOSITORIES],
	exports: [...REWARD_REPOSITORIES],
})
export class RewardsPersistenceModule {}
