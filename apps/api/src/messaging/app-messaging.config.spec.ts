import { EnvValidationError, ALL_QUEUE_NAMES, QUEUE_NAMES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestApiConfig } from "../../test/support/test-api-env";
import { buildAppMessagingConfig } from "./app-messaging.config";

/** `KAFKA_DELIVERY_TIMEOUT_MS` default (30 s). */
const DEFAULT_DELIVERY_TIMEOUT_MS = 30_000;

function captureEnvError(overrides: Readonly<Record<string, string>>): EnvValidationError {
	try {
		createTestApiConfig(overrides);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an EnvValidationError");
}

describe("buildAppMessagingConfig", () => {
	it("passes the validated broker settings to @workspace/messaging explicitly", () => {
		const config = createTestApiConfig({
			REDIS_URL: "redis://cache:6379",
			KAFKA_BROKERS: "k1:9092,k2:9092",
			RABBITMQ_URL: "amqp://mq:5672",
			MESSAGING_CLIENT_ID: "api-test",
			MESSAGING_CONNECTION_NAME: "api-test-conn",
		});

		expect(buildAppMessagingConfig(config.messaging)).toEqual({
			clientId: "api-test",
			connectionName: "api-test-conn",
			queueNames: ALL_QUEUE_NAMES,
			bullPrefix: "bull",
			healthQueueName: QUEUE_NAMES.emailSend,
			redisUrl: "redis://cache:6379",
			kafkaBrokers: ["k1:9092", "k2:9092"],
			kafkaSecurity: { tls: null, sasl: null },
			kafkaDeliveryTimeoutMs: DEFAULT_DELIVERY_TIMEOUT_MS,
			rabbitmqUrl: "amqp://mq:5672",
		});
	});

	it("passes TLS, SASL and the delivery timeout through from the environment", () => {
		const config = createTestApiConfig({
			KAFKA_BROKERS: "broker:9093",
			KAFKA_SSL: "true",
			KAFKA_SSL_CA_LOCATION: "/etc/kafka/ca.pem",
			KAFKA_SASL_MECHANISM: "scram-sha-512",
			KAFKA_SASL_USERNAME: "api",
			KAFKA_SASL_PASSWORD: "kafka-password-for-tests",
			KAFKA_DELIVERY_TIMEOUT_MS: "10000",
		});

		const options = buildAppMessagingConfig(config.messaging);

		expect(options.kafkaSecurity).toEqual({
			tls: { caLocation: "/etc/kafka/ca.pem" },
			sasl: { mechanism: "scram-sha-512", username: "api", password: "kafka-password-for-tests" },
		});
		expect(options.kafkaDeliveryTimeoutMs).toBe(10_000);
	});

	it("fails boot on an inconsistent Kafka security setup, naming the variable but never the secret", () => {
		const error = captureEnvError({
			KAFKA_BROKERS: "broker:9092",
			KAFKA_SASL_MECHANISM: "plain",
			KAFKA_SASL_USERNAME: "api",
			KAFKA_SASL_PASSWORD: "kafka-password-for-tests",
		});

		expect(error.variables).toEqual(["KAFKA_SASL_MECHANISM"]);
		expect(error.message).not.toContain("kafka-password-for-tests");
	});

	it("rejects a delivery timeout below librdkafka's 1 s floor", () => {
		expect(captureEnvError({ KAFKA_DELIVERY_TIMEOUT_MS: "999" }).variables).toEqual(["KAFKA_DELIVERY_TIMEOUT_MS"]);
	});

	it("uses BULLMQ_PREFIX for every queue and worker, defaulting to Bull Board's `bull`", () => {
		expect(buildAppMessagingConfig(createTestApiConfig().messaging).bullPrefix).toBe("bull");
		expect(buildAppMessagingConfig(createTestApiConfig({ BULLMQ_PREFIX: "e2e:run-42" }).messaging).bullPrefix).toBe("e2e:run-42");
	});

	it("rejects a BULLMQ_PREFIX that is not Redis-key safe", () => {
		expect(captureEnvError({ BULLMQ_PREFIX: "bull queue" }).variables).toEqual(["BULLMQ_PREFIX"]);
		expect(captureEnvError({ BULLMQ_PREFIX: ":leading-colon" }).variables).toEqual(["BULLMQ_PREFIX"]);
		expect(captureEnvError({ BULLMQ_PREFIX: "x".repeat(65) }).variables).toEqual(["BULLMQ_PREFIX"]);
	});

	it("disables every broker when none is configured", () => {
		const options = buildAppMessagingConfig(createTestApiConfig().messaging);

		expect([options.redisUrl, options.kafkaBrokers, options.rabbitmqUrl]).toEqual([undefined, undefined, undefined]);
		expect(options.clientId).toBe("hello-world-api");
	});
});
