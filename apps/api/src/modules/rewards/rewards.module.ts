import { OutboxModule } from "../../infrastructure/outbox/outbox.module";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationModule } from "../organization/organization.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { ConsumerClaimsController } from "./controllers/consumer-claims.controller";
import { ConsumerRewardsController } from "./controllers/consumer-rewards.controller";
import {
	OrganizationAnalyticsController,
	OrganizationApiKeysController,
	OrganizationKybController,
	OrganizationMembershipsBootstrapController,
	OrganizationRedemptionsController,
	OrganizationRewardMembershipsController,
	OrganizationRewardsController,
} from "./controllers/organization-rewards.controller";
import { MerchantOnboardingController } from "./controllers/merchant-onboarding.controller";
import { OrganizationTerminalsController, PosTerminalsController } from "./controllers/organization-terminals.controller";
import { RedemptionsController } from "./controllers/redemptions.controller";
import { RewardLegalController } from "./controllers/reward-legal.controller";
import { RewardNotificationsController } from "./controllers/reward-notifications.controller";
import {
	RewardsAdminAnalyticsController,
	RewardsAdminInvitesController,
	RewardsAdminLocationRequestsController,
	RewardsAdminMerchantsController,
	RewardsAdminRewardsController,
} from "./controllers/rewards-admin.controller";
import { MerchantApiKeyGuard } from "./guards/merchant-api-key.guard";
import { ClaimService } from "./services/claim.service";
import { ConsumerRewardsService } from "./services/consumer-rewards.service";
import { MerchantKybService } from "./services/merchant-kyb.service";
import { MerchantOnboardingService } from "./services/merchant-onboarding.service";
import { MerchantApiKeyService } from "./services/merchant-api-key.service";
import { MerchantTerminalService } from "./services/merchant-terminal.service";
import { PosPairingService } from "./services/pos-pairing.service";
import { MerchantContextService } from "./services/merchant-context.service";
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
import { getApiConfig } from "../../config/api-config";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first).
const redisUrl: string | undefined = getApiConfig().messaging.redisUrl;
const rewardsQueueImports = redisUrl !== undefined ? [RewardsQueueModule] : [];

@Module({
	imports: [
		AuthModule,
		OrganizationModule,
		NotificationsModule,
		OutboxModule,
		RewardsPersistenceModule,
		RewardsCoreServicesModule,
		StorageModule,
		FilesModule,
		...rewardsQueueImports,
	],
	controllers: [
		ConsumerRewardsController,
		ConsumerClaimsController,
		RewardLegalController,
		RewardNotificationsController,
		RedemptionsController,
		OrganizationMembershipsBootstrapController,
		OrganizationRewardMembershipsController,
		OrganizationKybController,
		MerchantOnboardingController,
		OrganizationRewardsController,
		OrganizationApiKeysController,
		OrganizationTerminalsController,
		PosTerminalsController,
		OrganizationRedemptionsController,
		OrganizationAnalyticsController,
		RewardsAdminAnalyticsController,
		RewardsAdminInvitesController,
		RewardsAdminRewardsController,
		RewardsAdminLocationRequestsController,
		RewardsAdminMerchantsController,
	],
	providers: [
		ConsumerRewardsService,
		ClaimService,
		RewardLegalService,
		RewardOtpService,
		RedemptionService,
		MerchantApiKeyService,
		MerchantTerminalService,
		PosPairingService,
		MerchantKybService,
		MerchantKybDocumentService,
		MerchantContextService,
		MerchantOnboardingService,
		RewardsAdminService,
		RewardsAnalyticsService,
		MerchantApiKeyGuard,
	],
	exports: [RewardsCoreServicesModule, ConsumerRewardsService, ClaimService],
})
export class RewardsModule {}
