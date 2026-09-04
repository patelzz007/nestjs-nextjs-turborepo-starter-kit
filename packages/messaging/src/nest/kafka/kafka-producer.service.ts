import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Kafka, Partitioners, type Producer } from "kafkajs";

import type { MessagingHealthIndicator } from "../../core/health";
import { MessageEnvelopeSchema, type MessageEnvelope } from "../../schemas/outbox";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { MESSAGING_OPTIONS } from "../tokens";

/** Publishes validated JSON envelopes to Kafka when brokers are configured. */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(KafkaProducerService.name);
	private producer: Producer | null = null;
	private admin: ReturnType<Kafka["admin"]> | null = null;

	public constructor(@Inject(MESSAGING_OPTIONS) private readonly options: ResolvedMessagingOptions) {}

	public isEnabled(): boolean {
		return this.options.kafkaBrokers !== undefined;
	}

	public async onModuleInit(): Promise<void> {
		const brokers = this.options.kafkaBrokers;
		if (brokers === undefined) {
			return;
		}
		const kafka = new Kafka({
			clientId: this.options.clientId,
			brokers: [...brokers],
		});
		this.producer = kafka.producer({
			createPartitioner: Partitioners.LegacyPartitioner,
			idempotent: true,
		});
		this.admin = kafka.admin();
		await this.producer.connect();
		await this.admin.connect();
		this.logger.log(`Kafka producer connected (${brokers.join(", ")})`);
	}

	public async onModuleDestroy(): Promise<void> {
		if (this.admin !== null) {
			await this.admin.disconnect();
			this.admin = null;
		}
		if (this.producer !== null) {
			await this.producer.disconnect();
			this.producer = null;
		}
	}

	public async publish(topic: string, envelope: MessageEnvelope, partitionKey: string | null = null): Promise<void> {
		if (this.producer === null) {
			return;
		}
		const validated = MessageEnvelopeSchema.parse(envelope);
		const messageKey = partitionKey ?? validated.correlationId ?? validated.type;
		await this.producer.send({
			topic,
			acks: -1,
			messages: [
				{
					key: messageKey,
					value: JSON.stringify(validated),
				},
			],
		});
	}

	public async ping(): Promise<boolean> {
		if (this.admin === null) {
			return false;
		}
		try {
			await this.admin.fetchTopicMetadata();
			return true;
		} catch {
			return false;
		}
	}
}

/** No-op producer when Kafka is disabled. */
@Injectable()
export class DisabledKafkaProducerService {
	public isEnabled(): boolean {
		return false;
	}

	public async publish(): Promise<void> {
		return;
	}

	public async ping(): Promise<boolean> {
		return true;
	}
}

@Injectable()
export class KafkaHealthIndicator implements MessagingHealthIndicator {
	public constructor(private readonly producer: KafkaProducerService) {}

	public async isHealthy(): Promise<boolean> {
		if (!this.producer.isEnabled()) {
			return true;
		}
		return this.producer.ping();
	}

	public getReport(): Promise<Record<string, string>> {
		return Promise.resolve({
			backend: this.producer.isEnabled() ? "kafkajs" : "disabled",
			brokers: this.producer.isEnabled() ? "configured" : "disabled",
		});
	}
}
