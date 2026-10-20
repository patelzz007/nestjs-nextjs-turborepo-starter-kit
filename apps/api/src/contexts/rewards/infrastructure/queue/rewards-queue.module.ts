import { Module } from "@nestjs/common";

import { SystemCommandModule } from "../../../../platform/infrastructure/system-command.module";
import { RewardsAutoPublishProcessor } from "../../presentation/jobs/rewards-auto-publish.processor";
import { RewardsAutoPublishScheduler } from "../adapters/rewards-auto-publish.scheduler";

/** The auto-publish BullMQ worker and its schedule; imported by the rewards module only when Redis is configured. */
@Module({
	imports: [SystemCommandModule],
	providers: [RewardsAutoPublishScheduler, RewardsAutoPublishProcessor],
})
export class RewardsQueueModule {}
