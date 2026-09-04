import { Module } from "@nestjs/common";

import { ClaimsExpireReferrerProcessor } from "./services/claims-expire-referrer.processor";
import { ClaimsExpirePendingProcessor, RewardsAutoPublishProcessor, RewardsQueueScheduler } from "./services/rewards-queue.processors";
import { RewardsCoreServicesModule } from "./rewards-core-services.module";

/**
 * BullMQ workers + schedulers for rewards maintenance.
 * Imported by {@link RewardsModule} only when `REDIS_URL` is configured.
 */
@Module({
	imports: [RewardsCoreServicesModule],
	providers: [RewardsQueueScheduler, RewardsAutoPublishProcessor, ClaimsExpirePendingProcessor, ClaimsExpireReferrerProcessor],
})
export class RewardsQueueModule {}
