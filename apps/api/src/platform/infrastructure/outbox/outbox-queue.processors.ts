import { Processor, InjectQueue, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { EmptyQueuePayloadSchema, MessageEnvelopeSchema, type MessageEnvelope } from "@workspace/messaging";
import { KafkaProducerNotConnectedError, KafkaProducerService } from "@workspace/messaging/nest";
import { QUEUE_NAMES, nowEpochMs, type KafkaTopic, type PlatformEventMessage } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { MaintenanceSchedulerRegistry } from "../jobs/maintenance-scheduler.registry";
import { OutboxDispatchRepository } from "./outbox-dispatch.repository";
import { OutboxDispatcher, OutboxPublisherUnavailableError, type OutboxClock, type OutboxDispatchSummary, type OutboxPublisher } from "./outbox-dispatcher";
import type { OutboxEmailRelaySummary } from "./outbox-email-relay";
import { OutboxEmailRelayService } from "./outbox-email-relay.service";
import { OUTBOX_PUBLISH_OPERATION } from "./outbox-operations";

/** What one sweep did on each route: Kafka (`null` when Kafka is off) and the email queue (`null` without a target). */
export interface OutboxSweepSummary {
	readonly kafka: OutboxDispatchSummary | null;
	readonly email: OutboxEmailRelaySummary | null;
}

const OUTBOX_SCHEDULER_ID = "outbox-publish";
const OUTBOX_SWEEP_INTERVAL_MS = 5_000;

export { OUTBOX_PUBLISH_OPERATION } from "./outbox-operations";

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

/**
 * Kafka adapter for the dispatcher's publisher port. A producer that is not
 * connected (still connecting in the background, or shutting down) sent
 * nothing — reported as {@link OutboxPublisherUnavailableError} so the row
 * keeps its attempts and stays PENDING.
 */
export class KafkaOutboxPublisher implements OutboxPublisher {
	public constructor(private readonly producer: KafkaProducerService) {}

	public async publish(topic: KafkaTopic, message: PlatformEventMessage, partitionKey: string | null): Promise<void> {
		try {
			await this.producer.publish(topic, toKafkaMessageEnvelope(message), partitionKey);
		} catch (error) {
			if (error instanceof KafkaProducerNotConnectedError) {
				throw new OutboxPublisherUnavailableError(error.message, { cause: error });
			}
			throw error;
		}
	}
}

/** Periodically sweeps pending outbox rows and publishes them to Kafka. */
@Injectable()
export class OutboxQueueScheduler implements OnModuleInit {
	public constructor(
		private readonly schedulers: MaintenanceSchedulerRegistry,
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES.outboxPublish) private readonly outboxQueue: Queue,
	) {}

	public onModuleInit(): void {
		if (!this.config.useBullMq) {
			return;
		}

		this.schedulers.add(this.outboxQueue, {
			queueName: QUEUE_NAMES.outboxPublish,
			schedulerId: OUTBOX_SCHEDULER_ID,
			everyMs: OUTBOX_SWEEP_INTERVAL_MS,
			jobName: "sweep",
			data: EmptyQueuePayloadSchema.parse({}),
		});
	}
}

@Processor(QUEUE_NAMES.outboxPublish)
@Injectable()
export class OutboxPublishProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(OutboxPublishProcessor.name);
	private readonly dispatcher: OutboxDispatcher;

	public constructor(
		_outboxQueueScheduler: OutboxQueueScheduler,
		private readonly config: TypedConfigService,
		dispatchRepository: OutboxDispatchRepository,
		private readonly kafkaProducer: KafkaProducerService,
		private readonly emailRelay: OutboxEmailRelayService,
	) {
		super();
		this.dispatcher = new OutboxDispatcher(dispatchRepository, new KafkaOutboxPublisher(kafkaProducer), SYSTEM_CLOCK, this.logger);
	}

	/**
	 * One sweep over both routes. Row-level failures are handled per row
	 * (backoff / dead-letter) and do not fail the job; only an infrastructure
	 * failure (e.g. the claim query) throws, and BullMQ retries it per the
	 * `outboxPublish` preset. Without Kafka, Kafka rows stay PENDING until it is
	 * enabled; email request rows are relayed to the email queue either way (ADR 060).
	 */
	public async process(job: Job): Promise<OutboxSweepSummary> {
		EmptyQueuePayloadSchema.parse(job.data);
		const kafka =
			this.config.useKafka && this.kafkaProducer.isEnabled()
				? await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async (): Promise<OutboxDispatchSummary> => this.dispatcher.dispatchDue())
				: null;
		const email = await this.emailRelay.relayDue();
		return { kafka, email };
	}
}
