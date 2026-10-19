import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { MaintenanceSchedulerRegistry } from "../../../../platform/infrastructure/jobs/maintenance-scheduler.registry";

const MS_PER_MINUTE = 60_000;
/** Due rewards are published every 10 minutes (the review window itself is 24 hours). */
const AUTO_PUBLISH_INTERVAL_MS = 10 * MS_PER_MINUTE;
const AUTO_PUBLISH_SCHEDULER_ID = "rewards-auto-publish";

/** Registers the repeatable auto-publish job (only when BullMQ is in use). */
@Injectable()
export class RewardsAutoPublishScheduler implements OnModuleInit {
	public constructor(
		private readonly schedulers: MaintenanceSchedulerRegistry,
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES.rewardsAutoPublish) private readonly autoPublishQueue: Queue,
	) {}

	public onModuleInit(): void {
		if (!this.config.useBullMq) {
			return;
		}
		this.schedulers.add(this.autoPublishQueue, {
			queueName: QUEUE_NAMES.rewardsAutoPublish,
			schedulerId: AUTO_PUBLISH_SCHEDULER_ID,
			everyMs: AUTO_PUBLISH_INTERVAL_MS,
			jobName: "auto-publish",
			data: RewardsMaintenanceJobSchema.parse({}),
		});
	}
}
