import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, StorageCleanupJobSchema } from "@workspace/shared";

import { MaintenanceSchedulerRegistry } from "../../../../platform/infrastructure/jobs/maintenance-scheduler.registry";

const MS_PER_MINUTE = 60_000;
/** The stale-upload sweep runs hourly. */
const STORAGE_CLEANUP_INTERVAL_MS = 60 * MS_PER_MINUTE;
const STORAGE_CLEANUP_SCHEDULER_ID = "storage-cleanup";

/** Registers the hourly stale-upload sweep. */
@Injectable()
export class StorageCleanupScheduler implements OnModuleInit {
	public constructor(
		@InjectQueue(QUEUE_NAMES.storageCleanup) private readonly cleanupQueue: Queue,
		private readonly schedulers: MaintenanceSchedulerRegistry,
	) {}

	public onModuleInit(): void {
		this.schedulers.add(this.cleanupQueue, {
			queueName: QUEUE_NAMES.storageCleanup,
			schedulerId: STORAGE_CLEANUP_SCHEDULER_ID,
			everyMs: STORAGE_CLEANUP_INTERVAL_MS,
			jobName: "cleanup-stale-uploads",
			data: StorageCleanupJobSchema.parse({}),
		});
	}
}
