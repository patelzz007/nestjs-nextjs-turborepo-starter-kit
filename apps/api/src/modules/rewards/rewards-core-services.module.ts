import { Module } from "@nestjs/common";

import { OrganizationModule } from "../organization/organization.module";

import { MerchantContextService } from "./services/merchant-context.service";
import { MerchantRewardService } from "./services/merchant-reward.service";
import { RewardNotificationService } from "./services/reward-notification.service";
import { RewardsPersistenceModule } from "./rewards-persistence.module";
import { RewardsPlatformEventsService } from "./services/rewards-platform-events.service";

/** Reward domain services shared by HTTP handlers and BullMQ maintenance workers. */
@Module({
	imports: [RewardsPersistenceModule, OrganizationModule],
	providers: [MerchantContextService, RewardNotificationService, RewardsPlatformEventsService, MerchantRewardService],
	exports: [MerchantContextService, RewardNotificationService, RewardsPlatformEventsService, MerchantRewardService, RewardsPersistenceModule],
})
export class RewardsCoreServicesModule {}
