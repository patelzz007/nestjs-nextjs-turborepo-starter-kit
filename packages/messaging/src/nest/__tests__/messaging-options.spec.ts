import { describe, expect, it } from "vitest";

import { DEFAULT_KAFKA_CONNECT_BACKOFF } from "../kafka/kafka-connect-backoff";
import { KAFKA_PLAINTEXT_SECURITY } from "../kafka/kafka-security";
import { resolveMessagingOptions, type MessagingModuleOptions } from "./messaging-options";

const DELIVERY_TIMEOUT_MS = 30_000;

const BASE_OPTIONS: MessagingModuleOptions = {
	clientId: "test-api",
	connectionName: "test-api",
	queueNames: ["email.send", "reports.generate"],
	redisUrl: "redis://localhost:6379",
	kafkaBrokers: ["localhost:9092"],
	kafkaSecurity: KAFKA_PLAINTEXT_SECURITY,
	kafkaDeliveryTimeoutMs: DELIVERY_TIMEOUT_MS,
	rabbitmqUrl: "amqp://localhost:5672",
};

describe("resolveMessagingOptions", () => {
	it("passes explicit connection settings through unchanged", () => {
		expect(resolveMessagingOptions(BASE_OPTIONS)).toEqual({
			clientId: "test-api",
			connectionName: "test-api",
			queueNames: ["email.send", "reports.generate"],
			bullPrefix: "bull",
			redisUrl: "redis://localhost:6379",
			kafkaBrokers: ["localhost:9092"],
			kafkaSecurity: KAFKA_PLAINTEXT_SECURITY,
			kafkaDeliveryTimeoutMs: DELIVERY_TIMEOUT_MS,
			kafkaConnectBackoff: DEFAULT_KAFKA_CONNECT_BACKOFF,
			rabbitmqUrl: "amqp://localhost:5672",
			healthQueueName: "email.send",
		});
	});

	it("treats undefined or empty settings as disabled — it never falls back to process.env", () => {
		const previous: string | undefined = process.env.REDIS_URL;
		process.env.REDIS_URL = "redis://should-not-be-read:6379";
		try {
			const resolved = resolveMessagingOptions({ ...BASE_OPTIONS, redisUrl: undefined, kafkaBrokers: [], rabbitmqUrl: "" });
			expect(resolved.redisUrl).toBeUndefined();
			expect(resolved.kafkaBrokers).toBeUndefined();
			expect(resolved.rabbitmqUrl).toBeUndefined();
		} finally {
			if (previous === undefined) {
				delete process.env.REDIS_URL;
			} else {
				process.env.REDIS_URL = previous;
			}
		}
	});

	it("validates an explicit Kafka connect backoff instead of trusting it", () => {
		const custom = { initialDelayMs: 500, maxDelayMs: 5_000, multiplier: 3, jitterRatio: 0.1 };
		expect(resolveMessagingOptions({ ...BASE_OPTIONS, kafkaConnectBackoff: custom }).kafkaConnectBackoff).toEqual(custom);
		expect(() => resolveMessagingOptions({ ...BASE_OPTIONS, kafkaConnectBackoff: { ...custom, maxDelayMs: 100 } })).toThrow();
	});

	it("honours an explicit bull prefix and health queue", () => {
		const resolved = resolveMessagingOptions({ ...BASE_OPTIONS, bullPrefix: "app", healthQueueName: "reports.generate" });
		expect(resolved.bullPrefix).toBe("app");
		expect(resolved.healthQueueName).toBe("reports.generate");
	});
});
