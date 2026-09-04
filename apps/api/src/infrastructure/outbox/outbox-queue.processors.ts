import { Processor, InjectQueue, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { EmptyQueuePayloadSchema } from "@workspace/messaging";
import { KafkaProducerService } from "@workspace/messaging/nest";
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "./platform-outbox.service";

const OUTBOX_SCHEDULER_ID = "outbox-publish";
const OUTBOX_SWEEP_INTERVAL_MS = 5_000;
const OUTBOX_BATCH_SIZE = 50;

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

		const payload = EmptyQueuePayloadSchema.parse({});
		await this.outboxQueue.upsertJobScheduler(OUTBOX_SCHEDULER_ID, { every: OUTBOX_SWEEP_INTERVAL_MS }, { name: "sweep", data: payload });
		this.logger.log("Registered BullMQ outbox publish scheduler");
	}
}

@Processor(QUEUE_NAMES[4])
@Injectable()
export class OutboxPublishProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(OutboxPublishProcessor.name);

	public constructor(
		outboxQueueScheduler: OutboxQueueScheduler,
		private readonly config: TypedConfigService,
		private readonly outboxService: PlatformOutboxService,
		private readonly kafkaProducer: KafkaProducerService,
	) {
		super();
		void outboxQueueScheduler;
	}

	public async process(job: Job): Promise<void> {
		EmptyQueuePayloadSchema.parse(job.data);
		if (!this.config.useKafka || !this.kafkaProducer.isEnabled()) {
			return;
		}

		const pending = await this.outboxService.listPendingForPublish(OUTBOX_BATCH_SIZE);
		for (const row of pending) {
			try {
				await this.kafkaProducer.publish(row.topic, row.envelope, row.partitionKey);
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
