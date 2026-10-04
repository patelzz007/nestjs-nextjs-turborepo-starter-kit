import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import { EmptyQueuePayloadSchema } from "@workspace/messaging";
import { QUEUE_JOB_OPTIONS } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { runWithSystemRlsContext } from "../../prisma/rls-context";
import {
	OUTBOX_PURGE_INTERVAL_MS,
	OUTBOX_RETENTION_JOB_NAME,
	OUTBOX_RETENTION_OPERATION,
	OUTBOX_RETENTION_QUEUE,
	OUTBOX_RETENTION_SCHEDULER_ID,
} from "./outbox-retention.constants";
import { OutboxRetentionService, type OutboxRetentionSummary } from "./outbox-retention.service";

/** The one queue capability the scheduler needs (narrowed so tests need no Redis). */
export type OutboxRetentionSchedulerRegistry = Pick<Queue, "upsertJobScheduler">;

/** The one job field the processor reads. */
export type OutboxRetentionJob = Pick<Job, "data">;

/**
 * Registers the hourly outbox retention job scheduler. `upsertJobScheduler`
 * is idempotent and keyed by a fixed id, so every API instance can call it at
 * boot and there is still exactly ONE scheduler (and one job per tick)
 * cluster-wide.
 */
@Injectable()
export class OutboxRetentionScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(OutboxRetentionScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(OUTBOX_RETENTION_QUEUE) private readonly retentionQueue: OutboxRetentionSchedulerRegistry,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		await this.retentionQueue.upsertJobScheduler(
			OUTBOX_RETENTION_SCHEDULER_ID,
			{ every: OUTBOX_PURGE_INTERVAL_MS },
			{ name: OUTBOX_RETENTION_JOB_NAME, data: EmptyQueuePayloadSchema.parse({}), opts: { ...QUEUE_JOB_OPTIONS.maintenance } },
		);
		this.logger.log(`Registered BullMQ ${OUTBOX_RETENTION_QUEUE} scheduler`);
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
