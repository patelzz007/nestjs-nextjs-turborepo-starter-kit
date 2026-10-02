import { describe, expect, it, vi } from "vitest";

import { MessageEnvelopeSchema } from "@workspace/messaging";
import { KafkaProducerService } from "@workspace/messaging/nest";
import { PlatformEventMessageSchema, type PlatformEventMessage } from "@workspace/shared";

import { KafkaOutboxPublisher, toKafkaMessageEnvelope } from "./outbox-queue.processors";

const EVENT_ID = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";

function buildMessage(): PlatformEventMessage {
	return PlatformEventMessageSchema.parse({
		eventId: EVENT_ID,
		type: "session.action",
		correlationId: "corr-1",
		occurredAt: 1_790_812_800_000,
		payload: { action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 2 },
	});
}

describe("toKafkaMessageEnvelope", () => {
	it("carries the stable eventId onto the broker envelope unchanged", () => {
		const envelope = toKafkaMessageEnvelope(buildMessage());

		expect(MessageEnvelopeSchema.parse(envelope)).toEqual({
			eventId: EVENT_ID,
			type: "session.action",
			correlationId: "corr-1",
			occurredAt: 1_790_812_800_000,
			payload: { action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 2 },
		});
	});
});

describe("KafkaOutboxPublisher", () => {
	it("publishes to the row's topic with its partition key and the eventId-bearing envelope", async () => {
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
		const publish = vi.spyOn(producer, "publish").mockResolvedValue(undefined);

		await new KafkaOutboxPublisher(producer).publish("platform.sessions", buildMessage(), "user-1");

		expect(publish).toHaveBeenCalledWith("platform.sessions", expect.objectContaining({ eventId: EVENT_ID, type: "session.action" }), "user-1");
	});

	it("propagates a broker failure so the dispatcher can schedule a retry", async () => {
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
		vi.spyOn(producer, "publish").mockRejectedValue(new Error("broker down"));

		await expect(new KafkaOutboxPublisher(producer).publish("platform.sessions", buildMessage(), null)).rejects.toThrow("broker down");
	});
});
