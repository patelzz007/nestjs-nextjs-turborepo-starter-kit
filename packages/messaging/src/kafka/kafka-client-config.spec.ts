import { KafkaJS } from "@confluentinc/kafka-javascript";
import { describe, expect, it } from "vitest";

import { buildKafkaClientConfig, createKafkaLogger, type KafkaClientLogOptions, type KafkaLogContext, type KafkaLogSink } from "./kafka-client-config";
import { KAFKA_PLAINTEXT_SECURITY } from "./kafka-security";

interface CapturedLine {
	readonly level: "error" | "warn" | "info" | "debug";
	readonly message: string;
	readonly context: KafkaLogContext;
}

function capturingSink(lines: CapturedLine[]): KafkaLogSink {
	return {
		error: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "error", message, context });
		},
		warn: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "warn", message, context });
		},
		info: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "info", message, context });
		},
		debug: (message: string, context: KafkaLogContext): void => {
			lines.push({ level: "debug", message, context });
		},
	};
}

/** Nothing listens here: the admin client connects without contacting a broker. */
const UNREACHABLE_BROKER = "127.0.0.1:1";

const LOG: KafkaClientLogOptions = { sink: capturingSink([]), level: KafkaJS.logLevel.WARN };

describe("buildKafkaClientConfig", () => {
	it("builds a plaintext config with only brokers, client id, logger and its level", () => {
		const config = buildKafkaClientConfig({ clientId: "api", brokers: ["a:9092", "b:9092"], security: KAFKA_PLAINTEXT_SECURITY, log: LOG });

		const { logger, ...compat } = config.kafkaJS ?? {};

		expect(Object.keys(config)).toEqual(["kafkaJS"]);
		expect(compat).toEqual({ clientId: "api", brokers: ["a:9092", "b:9092"], logLevel: KafkaJS.logLevel.WARN });
		expect(logger).toBeDefined();
	});

	it("keeps the real client at the configured level once it connects (no INFO chatter such as 'Admin client connected')", async () => {
		const lines: CapturedLine[] = [];
		const config = buildKafkaClientConfig({
			clientId: "api",
			brokers: [UNREACHABLE_BROKER],
			security: KAFKA_PLAINTEXT_SECURITY,
			log: { sink: capturingSink(lines), level: KafkaJS.logLevel.WARN },
		});
		// An admin client connects without a broker round trip — and, like every
		// client, pushes its librdkafka log_level into the logger when it does.
		const admin = new KafkaJS.Kafka(config).admin();
		await admin.connect();
		config.kafkaJS?.logger?.info("probe");
		await admin.disconnect();

		expect(config.kafkaJS?.logLevel).toBe(KafkaJS.logLevel.WARN);
		expect(lines).toEqual([]);
	});

	it("enables TLS, SASL and the CA file (outside the compat block, where librdkafka expects it)", () => {
		const config = buildKafkaClientConfig({
			clientId: "api",
			brokers: ["broker:9093"],
			security: { tls: { caLocation: "/etc/kafka/ca.pem" }, sasl: { mechanism: "scram-sha-512", username: "api", password: "pw" } },
			log: LOG,
		});

		const { kafkaJS, ...librdkafka } = config;
		const { logger, ...compat } = kafkaJS ?? {};

		expect(compat).toEqual({
			clientId: "api",
			brokers: ["broker:9093"],
			logLevel: KafkaJS.logLevel.WARN,
			ssl: true,
			sasl: { mechanism: "scram-sha-512", username: "api", password: "pw" },
		});
		expect(logger).toBeDefined();
		expect(librdkafka).toEqual({ "ssl.ca.location": "/etc/kafka/ca.pem" });
	});

	it("is accepted by the real client (the compat layer validates the config on construction)", () => {
		const config = buildKafkaClientConfig({
			clientId: "api",
			brokers: ["broker:9093"],
			security: { tls: { caLocation: null }, sasl: { mechanism: "scram-sha-256", username: "api", password: "pw" } },
			log: LOG,
		});

		expect(() => new KafkaJS.Kafka(config).admin()).not.toThrow();
	});
});

describe("createKafkaLogger", () => {
	it("forwards lines at or above the level with the librdkafka facility, and drops the rest", () => {
		const lines: CapturedLine[] = [];
		const logger = createKafkaLogger(capturingSink(lines), KafkaJS.logLevel.WARN);

		logger.error("broker down", { fac: "BROKERFAIL" });
		logger.warn("slow", {});
		logger.info("connected");
		logger.debug("noise");

		expect(lines).toEqual([
			{ level: "error", message: "broker down", context: { namespace: null, facility: "BROKERFAIL", repeats: null } },
			{ level: "warn", message: "slow", context: { namespace: null, facility: null, repeats: null } },
		]);
	});

	it("tags child loggers with their namespace and honours setLogLevel", () => {
		const lines: CapturedLine[] = [];
		const child = createKafkaLogger(capturingSink(lines), KafkaJS.logLevel.WARN).namespace("producer");

		child.info("hidden");
		child.setLogLevel(KafkaJS.logLevel.DEBUG);
		child.debug("visible");

		expect(lines).toEqual([{ level: "debug", message: "visible", context: { namespace: "producer", facility: null, repeats: null } }]);
	});
});
