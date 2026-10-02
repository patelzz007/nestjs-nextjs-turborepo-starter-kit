import { Processor, InjectQueue, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { EmptyQueuePayloadSchema, MessageEnvelopeSchema, type MessageEnvelope } from "@workspace/messaging";
import { KafkaProducerService } from "@workspace/messaging/nest";
import { QUEUE_NAMES, nowEpochMs, type KafkaTopic, type PlatformEventMessage } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";
import { runWithSystemRlsContext } from "../../prisma/rls-context";
import { registerMaintenanceScheduler } from "../jobs/maintenance-scheduler";
import { OutboxDispatchRepository } from "./outbox-dispatch.repository";
import { OutboxDispatcher, type OutboxClock, type OutboxDispatchSummary, type OutboxPublisher } from "./outbox-dispatcher";

const OUTBOX_SCHEDULER_ID = "outbox-publish";
const OUTBOX_SWEEP_INTERVAL_MS = 5_000;

/** Allowlisted system operation (system-operation.registry.ts) the dispatcher runs under. */
export const OUTBOX_PUBLISH_OPERATION = "outbox.publish";

const SYSTEM_CLOCK: OutboxClock = { nowEpochMs: (): number => nowEpochMs() };

/** Maps the platform wire message onto the generic broker envelope — `eventId` is carried through unchanged. */
export function toKafkaMessageEnvelope(message: PlatformEventMessage): MessageEnvelope {
	return MessageEnvelopeSchema.parse({
		eventId: message.eventId,
		type: message.type,
		correlationId: message.correlationId,
		occurredAt: message.occurredAt,
		payload: message.payload,
	});
}

/** Kafka adapter for the dispatcher's publisher port. */
export class KafkaOutboxPublisher implements OutboxPublisher {
	public constructor(private readonly producer: KafkaProducerService) {}

	public async publish(topic: KafkaTopic, message: PlatformEventMessage, partitionKey: string | null): Promise<void> {
		await this.producer.publish(topic, toKafkaMessageEnvelope(message), partitionKey);
	}
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

		await registerMaintenanceScheduler(
			this.outboxQueue,
			{ queueName: QUEUE_NAMES[4], schedulerId: OUTBOX_SCHEDULER_ID, everyMs: OUTBOX_SWEEP_INTERVAL_MS, jobName: "sweep", data: EmptyQueuePayloadSchema.parse({}) },
			this.logger,
		);
		this.logger.log("Registered BullMQ outbox publish scheduler");
	}
}

@Processor(QUEUE_NAMES[4])
@Injectable()
export class OutboxPublishProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(OutboxPublishProcessor.name);
	private readonly dispatcher: OutboxDispatcher;

	public constructor(
		_outboxQueueScheduler: OutboxQueueScheduler,
		private readonly config: TypedConfigService,
		dispatchRepository: OutboxDispatchRepository,
		private readonly kafkaProducer: KafkaProducerService,
	) {
		super();
		this.dispatcher = new OutboxDispatcher(dispatchRepository, new KafkaOutboxPublisher(kafkaProducer), SYSTEM_CLOCK, this.logger);
	}

	/**
	 * One sweep. Row-level publish failures are handled per row (backoff /
	 * dead-letter) and do not fail the job; only an infrastructure failure
	 * (e.g. the claim query) throws, and BullMQ retries it per the
	 * `outboxPublish` preset. Without Kafka, rows stay PENDING until it is enabled.
	 */
	public async process(job: Job): Promise<OutboxDispatchSummary | null> {
		EmptyQueuePayloadSchema.parse(job.data);
		if (!this.config.useKafka || !this.kafkaProducer.isEnabled()) {
			return null;
		}
		return runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async (): Promise<OutboxDispatchSummary> => this.dispatcher.dispatchDue());
	}
}
