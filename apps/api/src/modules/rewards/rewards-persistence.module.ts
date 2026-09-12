import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { MerchantApiKeyRepository } from "./repositories/merchant-api-key.repository";
import { MerchantKybDocumentRepository } from "./repositories/merchant-kyb-document.repository";
import { MerchantInviteRepository } from "./repositories/merchant-invite.repository";
import { MerchantMemberRepository } from "./repositories/merchant-member.repository";
import { MerchantOrgRepository } from "./repositories/merchant-org.repository";
import { MerchantRoleCapabilityRepository } from "./repositories/merchant-role-capability.repository";
import { RewardAuditLogRepository } from "./repositories/reward-audit-log.repository";
import { RewardClaimRepository } from "./repositories/reward-claim.repository";
import { RewardLegalAcceptanceRepository } from "./repositories/reward-legal-acceptance.repository";
import { RewardNotificationRepository } from "./repositories/reward-notification.repository";
import { RewardOtpChallengeRepository } from "./repositories/reward-otp-challenge.repository";
import { RewardRedemptionIdempotencyRepository } from "./repositories/reward-redemption-idempotency.repository";
import { RewardRedemptionRepository } from "./repositories/reward-redemption.repository";
import { RewardReferralRepository } from "./repositories/reward-referral.repository";
import { RewardRepository } from "./repositories/reward.repository";
import { RewardUserRepository } from "./repositories/reward-user.repository";

const REWARD_REPOSITORIES = [
	RewardRepository,
	RewardClaimRepository,
	RewardRedemptionRepository,
	RewardReferralRepository,
	RewardAuditLogRepository,
	RewardLegalAcceptanceRepository,
	RewardNotificationRepository,
	RewardOtpChallengeRepository,
	RewardRedemptionIdempotencyRepository,
	RewardUserRepository,
	MerchantOrgRepository,
	MerchantKybDocumentRepository,
	MerchantMemberRepository,
	MerchantApiKeyRepository,
	MerchantInviteRepository,
	MerchantRoleCapabilityRepository,
] as const;

@Module({
	imports: [PrismaModule],
	providers: [...REWARD_REPOSITORIES],
	exports: [...REWARD_REPOSITORIES],
})
export class RewardsPersistenceModule {}
