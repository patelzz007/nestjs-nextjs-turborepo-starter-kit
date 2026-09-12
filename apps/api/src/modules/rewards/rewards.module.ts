import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { ConsumerClaimsController } from "./controllers/consumer-claims.controller";
import { ConsumerRewardsController } from "./controllers/consumer-rewards.controller";
import {
	MerchantApiKeysController,
	MerchantAnalyticsController,
	MerchantKybController,
	MerchantProfileController,
	MerchantRedemptionsController,
	MerchantRewardsController,
} from "./controllers/merchant.controller";
import { MerchantMembersController, MerchantOnboardingController } from "./controllers/merchant-onboarding.controller";
import { RedemptionsController } from "./controllers/redemptions.controller";
import { RewardLegalController } from "./controllers/reward-legal.controller";
import { RewardNotificationsController } from "./controllers/reward-notifications.controller";
import {
	RewardsAdminInvitesController,
	RewardsAdminMerchantsController,
	RewardsAdminMerchantRoleCapabilitiesController,
	RewardsAdminRewardsController,
} from "./controllers/rewards-admin.controller";
import { MerchantApiKeyGuard } from "./guards/merchant-api-key.guard";
import { ClaimService } from "./services/claim.service";
import { ConsumerRewardsService } from "./services/consumer-rewards.service";
import { MerchantKybService } from "./services/merchant-kyb.service";
import { MerchantMemberService } from "./services/merchant-member.service";
import { MerchantOnboardingService } from "./services/merchant-onboarding.service";
import { MerchantApiKeyService } from "./services/merchant-api-key.service";
import { RedemptionService } from "./services/redemption.service";
import { RewardLegalService } from "./services/reward-legal.service";
import { RewardOtpService } from "./services/reward-otp.service";
import { RewardsAdminService } from "./services/rewards-admin.service";
import { RewardsAnalyticsService } from "./services/rewards-analytics.service";
import { RewardsCoreServicesModule } from "./rewards-core-services.module";
import { RewardsPersistenceModule } from "./rewards-persistence.module";
import { RewardsQueueModule } from "./rewards-queue.module";
import { FilesModule } from "../files/files.module";
import { StorageModule } from "../storage/storage.module";
import { MerchantKybDocumentService } from "./services/merchant-kyb-document.service";

const redisUrl: string | undefined = process.env.REDIS_URL;
const rewardsQueueImports = redisUrl !== undefined && redisUrl.length > 0 ? [RewardsQueueModule] : [];

@Module({
	imports: [AuthModule, NotificationsModule, RewardsPersistenceModule, RewardsCoreServicesModule, StorageModule, FilesModule, ...rewardsQueueImports],
	controllers: [
		ConsumerRewardsController,
		ConsumerClaimsController,
		RewardLegalController,
		RewardNotificationsController,
		RedemptionsController,
		MerchantProfileController,
		MerchantKybController,
		MerchantOnboardingController,
		MerchantMembersController,
		MerchantRewardsController,
		MerchantApiKeysController,
		MerchantRedemptionsController,
		MerchantAnalyticsController,
		RewardsAdminInvitesController,
		RewardsAdminRewardsController,
		RewardsAdminMerchantsController,
		RewardsAdminMerchantRoleCapabilitiesController,
	],
	providers: [
		ConsumerRewardsService,
		ClaimService,
		RewardLegalService,
		RewardOtpService,
		RedemptionService,
		MerchantApiKeyService,
		MerchantKybService,
		MerchantKybDocumentService,
		MerchantMemberService,
		MerchantOnboardingService,
		RewardsAdminService,
		RewardsAnalyticsService,
		MerchantApiKeyGuard,
	],
	exports: [RewardsCoreServicesModule, ConsumerRewardsService, ClaimService],
})
export class RewardsModule {}
