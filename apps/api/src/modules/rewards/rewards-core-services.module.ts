import { Module } from "@nestjs/common";

import { OutboxModule } from "../../infrastructure/outbox/outbox.module";
import { OrganizationModule } from "../organization/organization.module";

import { MerchantContextService } from "./services/merchant-context.service";
import { MerchantRewardService } from "./services/merchant-reward.service";
import { RewardNotificationService } from "./services/reward-notification.service";
import { RewardsPersistenceModule } from "./rewards-persistence.module";

/** Reward domain services shared by HTTP handlers and BullMQ maintenance workers. */
@Module({
	imports: [RewardsPersistenceModule, OrganizationModule, OutboxModule],
	providers: [MerchantContextService, RewardNotificationService, MerchantRewardService],
	exports: [MerchantContextService, RewardNotificationService, MerchantRewardService, RewardsPersistenceModule],
})
export class RewardsCoreServicesModule {}
