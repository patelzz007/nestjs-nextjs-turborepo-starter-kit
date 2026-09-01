import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { ConsumerClaimsController } from "./controllers/consumer-claims.controller";
import { ConsumerRewardsController } from "./controllers/consumer-rewards.controller";
import {
	MerchantApiKeysController,
	MerchantAnalyticsController,
	MerchantProfileController,
	MerchantRedemptionsController,
	MerchantRewardsController,
} from "./controllers/merchant.controller";
import { RedemptionsController } from "./controllers/redemptions.controller";
import { RewardLegalController } from "./controllers/reward-legal.controller";
import { RewardNotificationsController } from "./controllers/reward-notifications.controller";
import { RewardsAdminInvitesController, RewardsAdminMerchantsController, RewardsAdminRewardsController } from "./controllers/rewards-admin.controller";
import { MerchantApiKeyGuard } from "./guards/merchant-api-key.guard";
import { ClaimService } from "./services/claim.service";
import { ConsumerRewardsService } from "./services/consumer-rewards.service";
import { MerchantApiKeyService } from "./services/merchant-api-key.service";
import { MerchantContextService } from "./services/merchant-context.service";
import { MerchantRewardService } from "./services/merchant-reward.service";
import { RedemptionService } from "./services/redemption.service";
import { RewardLegalService } from "./services/reward-legal.service";
import { RewardNotificationService } from "./services/reward-notification.service";
import { RewardOtpService } from "./services/reward-otp.service";
import { RewardsAdminService } from "./services/rewards-admin.service";
import { RewardsAnalyticsService } from "./services/rewards-analytics.service";
import { RewardsJobsService } from "./services/rewards-jobs.service";

@Module({
	imports: [PrismaModule, AuthModule, NotificationsModule],
	controllers: [
		ConsumerRewardsController,
		ConsumerClaimsController,
		RewardLegalController,
		RewardNotificationsController,
		RedemptionsController,
		MerchantProfileController,
		MerchantRewardsController,
		MerchantApiKeysController,
		MerchantRedemptionsController,
		MerchantAnalyticsController,
		RewardsAdminInvitesController,
		RewardsAdminRewardsController,
		RewardsAdminMerchantsController,
	],
	providers: [
		MerchantContextService,
		ConsumerRewardsService,
		ClaimService,
		RewardLegalService,
		RewardOtpService,
		RewardNotificationService,
		RedemptionService,
		MerchantRewardService,
		MerchantApiKeyService,
		RewardsAdminService,
		RewardsAnalyticsService,
		RewardsJobsService,
		MerchantApiKeyGuard,
	],
	exports: [ConsumerRewardsService, ClaimService, MerchantRewardService],
})
export class RewardsModule {}
