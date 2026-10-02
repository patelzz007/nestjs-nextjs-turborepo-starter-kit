import { describe, expect, it } from "vitest";

import { resolveMessagingOptions, type MessagingModuleOptions } from "./messaging-options";

const BASE_OPTIONS: MessagingModuleOptions = {
	clientId: "test-api",
	connectionName: "test-api",
	queueNames: ["email.send", "reports.generate"],
	redisUrl: "redis://localhost:6379",
	kafkaBrokers: ["localhost:9092"],
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

	it("honours an explicit bull prefix and health queue", () => {
		const resolved = resolveMessagingOptions({ ...BASE_OPTIONS, bullPrefix: "app", healthQueueName: "reports.generate" });
		expect(resolved.bullPrefix).toBe("app");
		expect(resolved.healthQueueName).toBe("reports.generate");
	});
});
