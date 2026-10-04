import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import { EmptyQueuePayloadSchema } from "@workspace/messaging";
import { QUEUE_JOB_OPTIONS, QUEUE_NAMES } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { runWithSystemRlsContext } from "../../prisma/rls-context";
import { IdempotencyRetentionService, type IdempotencyRetentionSummary } from "./idempotency-retention.service";
import { IDEMPOTENCY_PURGE_INTERVAL_MS, IDEMPOTENCY_PURGE_SCHEDULER_ID, IDEMPOTENCY_RETENTION_OPERATION } from "./idempotency.constants";

/** The `idempotency.retention` BullMQ queue. */
export const IDEMPOTENCY_RETENTION_QUEUE = QUEUE_NAMES.idempotencyRetention;

/** The one queue capability the scheduler needs (narrowed so tests need no Redis). */
export type JobSchedulerRegistry = Pick<Queue, "upsertJobScheduler">;

/** The one job field the processor reads. */
export type RetentionJob = Pick<Job, "data">;

/** Name of the repeatable job the scheduler emits. */
export const IDEMPOTENCY_RETENTION_JOB_NAME = "purge-expired";

/**
 * Registers the hourly retention job scheduler. `upsertJobScheduler` is
 * idempotent and keyed by a fixed id, so every API instance can call it at
 * boot and there is still exactly ONE scheduler (and one job per tick)
 * cluster-wide — the job is processed by a single worker, never by every
 * instance the way an in-process `@Cron` would be.
 */
@Injectable()
export class IdempotencyRetentionScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(IdempotencyRetentionScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(IDEMPOTENCY_RETENTION_QUEUE) private readonly retentionQueue: JobSchedulerRegistry,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		await this.retentionQueue.upsertJobScheduler(
			IDEMPOTENCY_PURGE_SCHEDULER_ID,
			{ every: IDEMPOTENCY_PURGE_INTERVAL_MS },
			{ name: IDEMPOTENCY_RETENTION_JOB_NAME, data: EmptyQueuePayloadSchema.parse({}), opts: { ...QUEUE_JOB_OPTIONS.maintenance } },
		);
		this.logger.log(`Registered BullMQ ${IDEMPOTENCY_RETENTION_QUEUE} scheduler`);
	}
}

/**
 * One retention run per scheduler tick, under the allowlisted
 * `idempotency.retention` system operation. A failure (e.g. the database is
 * down) throws, so BullMQ retries it per the `maintenance` preset.
 */
@Processor(IDEMPOTENCY_RETENTION_QUEUE)
@Injectable()
export class IdempotencyRetentionProcessor extends WorkerHost {
	public constructor(private readonly retention: IdempotencyRetentionService) {
		super();
	}

	public async process(job: RetentionJob): Promise<IdempotencyRetentionSummary> {
		EmptyQueuePayloadSchema.parse(job.data);
		return runWithSystemRlsContext(IDEMPOTENCY_RETENTION_OPERATION, async (): Promise<IdempotencyRetentionSummary> => this.retention.purgeExpired());
	}
}
