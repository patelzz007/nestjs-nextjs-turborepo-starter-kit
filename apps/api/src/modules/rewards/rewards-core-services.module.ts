import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module";

import { MerchantCapabilityService } from "./services/merchant-capability.service";
import { MerchantContextService } from "./services/merchant-context.service";
import { MerchantRewardService } from "./services/merchant-reward.service";
import { RewardNotificationService } from "./services/reward-notification.service";
import { RewardsPersistenceModule } from "./rewards-persistence.module";
import { RewardsPlatformEventsService } from "./services/rewards-platform-events.service";

/** Reward domain services shared by HTTP handlers and BullMQ maintenance workers. */
@Module({
	imports: [RewardsPersistenceModule, AuthorizationModule],
	providers: [MerchantCapabilityService, MerchantContextService, RewardNotificationService, RewardsPlatformEventsService, MerchantRewardService],
	exports: [MerchantCapabilityService, MerchantContextService, RewardNotificationService, RewardsPlatformEventsService, MerchantRewardService, RewardsPersistenceModule],
})
export class RewardsCoreServicesModule {}
