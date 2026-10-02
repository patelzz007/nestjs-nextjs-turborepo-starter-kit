import { beforeEach, describe, expect, it, vi } from "vitest";

import { KAFKA_EVENT_ID_HEADER, KAFKA_EVENT_TYPE_HEADER, KafkaProducerService } from "./kafka-producer.service";
import type { MessageEnvelope } from "../../schemas/outbox";

interface SentRecord {
	readonly topic: string;
	readonly acks: number;
	readonly messages: readonly { readonly key: string; readonly value: string; readonly headers: Readonly<Record<string, string>> }[];
}

interface FakeAdmin {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}

interface FakeProducer extends FakeAdmin {
	send(record: SentRecord): Promise<void>;
}

const kafka = vi.hoisted(() => ({
	sent: new Array<SentRecord>(),
}));

vi.mock("kafkajs", () => {
	const singlePartition = (): (() => number) => (): number => 0;
	return {
		Partitioners: { LegacyPartitioner: singlePartition },
		Kafka: class {
			public producer(): FakeProducer {
				return {
					connect: async (): Promise<void> => Promise.resolve(),
					disconnect: async (): Promise<void> => Promise.resolve(),
					send: async (record: SentRecord): Promise<void> => {
						kafka.sent.push(record);
						return Promise.resolve();
					},
				};
			}

			public admin(): FakeAdmin {
				return {
					connect: async (): Promise<void> => Promise.resolve(),
					disconnect: async (): Promise<void> => Promise.resolve(),
				};
			}
		},
	};
});

const ENVELOPE: MessageEnvelope = {
	eventId: "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11",
	type: "session.action",
	correlationId: "corr-1",
	occurredAt: 1_790_812_800_000,
	payload: { userId: "user-1" },
};

async function connectedProducer(): Promise<KafkaProducerService> {
	const producer = new KafkaProducerService({
		clientId: "test",
		connectionName: "test",
		queueNames: [],
		bullPrefix: "bull",
		redisUrl: undefined,
		kafkaBrokers: ["localhost:9092"],
		rabbitmqUrl: undefined,
		healthQueueName: undefined,
	});
	await producer.onModuleInit();
	return producer;
}

describe("KafkaProducerService.publish", () => {
	beforeEach(() => {
		kafka.sent.length = 0;
	});

	it("sends the validated envelope with the stable event id and type as headers", async () => {
		const producer = await connectedProducer();

		await producer.publish("platform.sessions", ENVELOPE, "user-1");

		expect(kafka.sent).toEqual([
			{
				topic: "platform.sessions",
				acks: -1,
				messages: [
					{
						key: "user-1",
						value: JSON.stringify(ENVELOPE),
						headers: { [KAFKA_EVENT_ID_HEADER]: ENVELOPE.eventId, [KAFKA_EVENT_TYPE_HEADER]: "session.action" },
					},
				],
			},
		]);
	});

	it("falls back to the correlation id as the message key", async () => {
		const producer = await connectedProducer();

		await producer.publish("platform.sessions", ENVELOPE);

		expect(kafka.sent[0]?.messages[0]?.key).toBe("corr-1");
	});

	it("refuses an envelope without a uuid eventId (consumers could not dedupe it)", async () => {
		const producer = await connectedProducer();

		await expect(producer.publish("platform.sessions", { ...ENVELOPE, eventId: "not-a-uuid" })).rejects.toThrow();
		expect(kafka.sent).toEqual([]);
	});

	it("is a no-op when Kafka is not configured", async () => {
		const producer = new KafkaProducerService({
			clientId: "test",
			connectionName: "test",
			queueNames: [],
			bullPrefix: "bull",
			redisUrl: undefined,
			kafkaBrokers: undefined,
			rabbitmqUrl: undefined,
			healthQueueName: undefined,
		});
		await producer.onModuleInit();

		await producer.publish("platform.sessions", ENVELOPE);

		expect(producer.isEnabled()).toBe(false);
		expect(kafka.sent).toEqual([]);
	});
});
