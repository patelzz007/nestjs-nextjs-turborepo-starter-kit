import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { FeatureFlagsMaintenanceJobSchema, QUEUE_NAMES } from "@workspace/shared";
import type { Queue } from "bullmq";

import { MaintenanceSchedulerRegistry } from "../../../../platform/infrastructure/jobs/maintenance-scheduler.registry";

/** Every minute: a scheduled rollout's step is announced within a minute of its time (clients also refetch at `nextChangeAt`). */
const MAINTENANCE_INTERVAL_MS = 60_000;
const MAINTENANCE_SCHEDULER_ID = "feature-flags-maintenance";

/** Registers the repeatable maintenance job (imported only when BullMQ is in use). */
@Injectable()
export class FeatureFlagsMaintenanceScheduler implements OnModuleInit {
	public constructor(
		private readonly schedulers: MaintenanceSchedulerRegistry,
		@InjectQueue(QUEUE_NAMES.featureFlagsMaintenance) private readonly queue: Queue,
	) {}

	public onModuleInit(): void {
		this.schedulers.add(this.queue, {
			queueName: QUEUE_NAMES.featureFlagsMaintenance,
			schedulerId: MAINTENANCE_SCHEDULER_ID,
			everyMs: MAINTENANCE_INTERVAL_MS,
			jobName: "maintenance",
			data: FeatureFlagsMaintenanceJobSchema.parse({}),
		});
	}
}
