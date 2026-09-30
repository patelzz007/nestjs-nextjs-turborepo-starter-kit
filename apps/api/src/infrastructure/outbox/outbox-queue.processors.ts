import { Processor, InjectQueue, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue, hasLegacyRepeatableKeyShape } from "bullmq";

import { EmptyQueuePayloadSchema, MessageEnvelopeSchema, type MessageEnvelope } from "@workspace/messaging";
import { KafkaProducerService } from "@workspace/messaging/nest";
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS, type PlatformEventEnvelope } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "./platform-outbox.service";
import { runWithSystemRlsContext } from "../../prisma/rls-context";

const OUTBOX_SCHEDULER_ID = "outbox-publish";
const OUTBOX_SWEEP_INTERVAL_MS = 5_000;
const OUTBOX_BATCH_SIZE = 50;

/** BullMQ job-scheduler iterations use ids like `repeat:<schedulerId>:<millis>`. */
export function isSchedulerIterationFor(jobId: string | undefined, schedulerId: string): boolean {
	if (!jobId?.startsWith("repeat:")) return false;

	return jobId.startsWith(`repeat:${schedulerId}:`);
}

export function isSchedulerIterationJob(jobOrId: Job | string | undefined): boolean {
	if (jobOrId === undefined) return false;

	const jobId = typeof jobOrId === "string" ? jobOrId : (jobOrId.id ?? "");
	return jobId.startsWith("repeat:");
}

function toKafkaMessageEnvelope(envelope: PlatformEventEnvelope): MessageEnvelope {
	const serialized: MessageEnvelope = MessageEnvelopeSchema.parse({
		type: envelope.type,
		correlationId: envelope.correlationId,
		occurredAt: envelope.occurredAt,
		payload: envelope.payload,
	});
	return serialized;
}

/** Periodically sweeps pending outbox rows and publishes them to Kafka. */
@Injectable()
export class OutboxQueueScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(OutboxQueueScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES[4]) private readonly outboxQueue: Queue,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		await this.removeLegacyRepeatableJobs();

		const payload = EmptyQueuePayloadSchema.parse({});
		await this.outboxQueue.upsertJobScheduler(OUTBOX_SCHEDULER_ID, { every: OUTBOX_SWEEP_INTERVAL_MS }, { name: "sweep", data: payload });
		this.logger.log("Registered BullMQ outbox publish scheduler");
	}

	private async removeLegacyRepeatableJobs(): Promise<void> {
		const schedulers = await this.outboxQueue.getJobSchedulers(0, -1, true);
		for (const scheduler of schedulers) {
			const schedulerKey = scheduler.key;
			const isThisScheduler = schedulerKey === `repeat:${OUTBOX_SCHEDULER_ID}` || isSchedulerIterationFor(schedulerKey, OUTBOX_SCHEDULER_ID);
			if (!hasLegacyRepeatableKeyShape(schedulerKey) && !isThisScheduler) {
				continue;
			}
			try {
				await this.outboxQueue.removeJobScheduler(schedulerKey);
				this.logger.log(`Removed stale scheduler ${schedulerKey} from ${QUEUE_NAMES[4]}`);
			} catch (error) {
				this.logger.warn(`Could not remove stale scheduler ${schedulerKey} from ${QUEUE_NAMES[4]}: ${String(error)}`);
			}
		}

		const jobs = await this.outboxQueue.getJobs(["delayed", "waiting", "active", "failed"], 0, 500);
		for (const job of jobs) {
			const repeatJobKey = job.repeatJobKey ?? "";
			const jobId = job.id ?? "";
			const isRepeatIteration = isSchedulerIterationJob(jobId) || isSchedulerIterationJob(repeatJobKey);
			if (isRepeatIteration && (isSchedulerIterationFor(jobId, OUTBOX_SCHEDULER_ID) || isSchedulerIterationFor(repeatJobKey, OUTBOX_SCHEDULER_ID))) {
				const staleKey = repeatJobKey || jobId || "unknown";
				try {
					if (staleKey.startsWith("repeat:")) {
						await this.outboxQueue.removeJobScheduler(staleKey);
					}
					this.logger.log(`Removed stale scheduler iteration ${staleKey} from ${QUEUE_NAMES[4]}`);
				} catch (error) {
					this.logger.warn(`Could not remove stale scheduler iteration ${staleKey} from ${QUEUE_NAMES[4]}: ${String(error)}`);
				}
				continue;
			}

			if (isRepeatIteration) {
				continue;
			}

			const isLegacyRepeat = repeatJobKey !== "" && hasLegacyRepeatableKeyShape(repeatJobKey);
			const isCorruptTimestamp = job.timestamp <= 0;
			if (!isLegacyRepeat && !isCorruptTimestamp) {
				continue;
			}

			try {
				await job.remove();
				this.logger.log(`Removed stale delayed job ${String(job.id)} from ${QUEUE_NAMES[4]}`);
			} catch (error) {
				this.logger.warn(`Could not remove stale job ${String(job.id)} from ${QUEUE_NAMES[4]}: ${String(error)}`);
			}
		}
	}
}

@Processor(QUEUE_NAMES[4])
@Injectable()
export class OutboxPublishProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(OutboxPublishProcessor.name);

	public constructor(
		_outboxQueueScheduler: OutboxQueueScheduler,
		private readonly config: TypedConfigService,
		private readonly outboxService: PlatformOutboxService,
		private readonly kafkaProducer: KafkaProducerService,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		EmptyQueuePayloadSchema.parse(job.data);
		if (!this.config.useKafka || !this.kafkaProducer.isEnabled()) {
			return;
		}

		const pending = await this.outboxService.listPendingForPublish(OUTBOX_BATCH_SIZE);
		for (const row of pending) {
			try {
				await this.kafkaProducer.publish(row.topic, toKafkaMessageEnvelope(row.envelope), row.partitionKey);
				await this.outboxService.markPublished(row.id);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Outbox publish failed for ${row.id}: ${message}`);
				await this.outboxService.markRetry(row.id, message);
				if (job.attemptsMade >= QUEUE_JOB_OPTIONS.outboxPublish.attempts - 1) {
					await this.outboxService.markFailed(row.id, message);
				}
				throw error;
			}
		}
	}
}
