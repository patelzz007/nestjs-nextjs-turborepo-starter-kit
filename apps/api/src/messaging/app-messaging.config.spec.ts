import { QUEUE_NAMES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestApiConfig } from "../../test/support/test-api-env";
import { buildAppMessagingConfig } from "./app-messaging.config";

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
			queueNames: QUEUE_NAMES,
			bullPrefix: "bull",
			healthQueueName: QUEUE_NAMES[0],
			redisUrl: "redis://cache:6379",
			kafkaBrokers: ["k1:9092", "k2:9092"],
			rabbitmqUrl: "amqp://mq:5672",
		});
	});

	it("disables every broker when none is configured", () => {
		const options = buildAppMessagingConfig(createTestApiConfig().messaging);

		expect([options.redisUrl, options.kafkaBrokers, options.rabbitmqUrl]).toEqual([undefined, undefined, undefined]);
		expect(options.clientId).toBe("hello-world-api");
	});
});
