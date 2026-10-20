import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Job } from "bullmq";

import { EmptyQueuePayloadSchema } from "@workspace/messaging";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { MaintenanceSchedulerQueue } from "../jobs/maintenance-scheduler";
import { MaintenanceSchedulerRegistry } from "../jobs/maintenance-scheduler.registry";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import {
	OUTBOX_PURGE_INTERVAL_MS,
	OUTBOX_RETENTION_JOB_NAME,
	OUTBOX_RETENTION_OPERATION,
	OUTBOX_RETENTION_QUEUE,
	OUTBOX_RETENTION_SCHEDULER_ID,
} from "./outbox-retention.constants";
import { OutboxRetentionService, type OutboxRetentionSummary } from "./outbox-retention.service";

/** The one job field the processor reads. */
export type OutboxRetentionJob = Pick<Job, "data">;

/**
 * Adds the hourly outbox retention job scheduler to the {@link MaintenanceSchedulerRegistry}, which
 * registers it after boot. `upsertJobScheduler` is idempotent and keyed by a fixed id, so every API
 * instance registers it and there is still exactly ONE scheduler (and one job per tick) cluster-wide.
 */
@Injectable()
export class OutboxRetentionScheduler implements OnModuleInit {
	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(OUTBOX_RETENTION_QUEUE) private readonly retentionQueue: MaintenanceSchedulerQueue,
		private readonly schedulers: MaintenanceSchedulerRegistry,
	) {}

	public onModuleInit(): void {
		if (!this.config.useBullMq) {
			return;
		}
		this.schedulers.add(this.retentionQueue, {
			queueName: OUTBOX_RETENTION_QUEUE,
			schedulerId: OUTBOX_RETENTION_SCHEDULER_ID,
			everyMs: OUTBOX_PURGE_INTERVAL_MS,
			jobName: OUTBOX_RETENTION_JOB_NAME,
			data: EmptyQueuePayloadSchema.parse({}),
		});
	}
}

/**
 * One retention run per scheduler tick, under the allowlisted
 * `outbox.retention` system operation. A failure (e.g. the database is down)
 * throws, so BullMQ retries it per the `maintenance` preset.
 */
@Processor(OUTBOX_RETENTION_QUEUE)
@Injectable()
export class OutboxRetentionProcessor extends WorkerHost {
	public constructor(
		_scheduler: OutboxRetentionScheduler,
		private readonly retention: OutboxRetentionService,
	) {
		super();
	}

	public async process(job: OutboxRetentionJob): Promise<OutboxRetentionSummary> {
		EmptyQueuePayloadSchema.parse(job.data);
		return runWithSystemRlsContext(OUTBOX_RETENTION_OPERATION, async (): Promise<OutboxRetentionSummary> => this.retention.purgeSettled());
	}
}
