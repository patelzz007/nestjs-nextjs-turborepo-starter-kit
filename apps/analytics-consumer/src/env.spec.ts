import { LIST_SLOT_INDEX, EnvValidationError } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	CONSUMER_ENV_SCOPE,
	DEFAULT_DB_POOL_MAX,
	DEFAULT_DEAD_LETTER_MAX_PAYLOAD_BYTES,
	DEFAULT_DEAD_LETTER_RETENTION_DAYS,
	DEFAULT_KAFKA_TOPIC_RETENTION_DAYS,
	DEFAULT_MAX_PROCESSING_ATTEMPTS,
	DEFAULT_SHUTDOWN_TIMEOUT_MS,
	defaultInboxRetentionDays,
	MAX_RETENTION_DAYS,
	parseConsumerEnv,
	parseDbLoginProvisioningEnv,
	parseTopicProvisioningEnv,
} from "./env";

const CONSUMER_URL = "postgresql://analytics_consumer_app:pw@localhost/db";
const VALID = { ANALYTICS_CONSUMER_DATABASE_URL: CONSUMER_URL, KAFKA_BROKERS: "a:9092" };

function captureEnvError(parse: () => object): EnvValidationError {
	try {
		parse();
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an EnvValidationError");
}

describe("parseConsumerEnv", () => {
	it("parses the broker list and resolves every documented default", () => {
		const env = parseConsumerEnv({ ANALYTICS_CONSUMER_DATABASE_URL: CONSUMER_URL, KAFKA_BROKERS: " a:9092, ,b:9092 " });

		expect(env.kafka.brokers).toEqual(["a:9092", "b:9092"]);
		expect(env.kafka.security).toEqual({ tls: null, sasl: null });
		expect(env.kafka.topicRetentionDays).toBe(DEFAULT_KAFKA_TOPIC_RETENTION_DAYS);
		expect(env.startFrom).toBe("earliest");
		expect(env.shutdownTimeoutMs).toBe(DEFAULT_SHUTDOWN_TIMEOUT_MS);
		expect(env.dbPool.max).toBe(DEFAULT_DB_POOL_MAX);
		expect(env.retry.maxAttempts).toBe(DEFAULT_MAX_PROCESSING_ATTEMPTS);
		expect(env.inboxRetentionDays).toBe(DEFAULT_KAFKA_TOPIC_RETENTION_DAYS * 2);
		expect(env.deadLetterRetentionDays).toBe(DEFAULT_DEAD_LETTER_RETENTION_DAYS);
		expect(env.deadLetterMaxPayloadBytes).toBe(DEFAULT_DEAD_LETTER_MAX_PAYLOAD_BYTES);
	});

	it("reads its own variables only — not the API's DATABASE_URL", () => {
		const error = captureEnvError(() =>
			parseConsumerEnv({ DATABASE_URL: "postgresql://postgres:postgres@localhost/db", KAFKA_BROKERS: "a:9092", JWT_ACCESS_SECRET: "api-only" }),
		);

		expect(error.scope).toBe(CONSUMER_ENV_SCOPE);
		expect(error.variables).toEqual(["ANALYTICS_CONSUMER_DATABASE_URL"]);
	});

	it("lists every missing variable by name in one value-free error", () => {
		expect(captureEnvError(() => parseConsumerEnv({})).variables).toEqual(["ANALYTICS_CONSUMER_DATABASE_URL", "KAFKA_BROKERS"]);
	});

	it("requires a postgres URL and never prints its credentials", () => {
		const error = captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_CONSUMER_DATABASE_URL: "mysql://root:hunter2hunter2@db/app" }));

		expect(error.variables).toEqual(["ANALYTICS_CONSUMER_DATABASE_URL"]);
		expect(error.message).not.toContain("hunter2hunter2");
	});

	it("rejects an empty broker list and brokers without a port", () => {
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, KAFKA_BROKERS: " , " })).issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/at least one/);
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, KAFKA_BROKERS: "localhost" })).variables).toEqual(["KAFKA_BROKERS.0"]);
	});

	it("maps TLS / SASL and rejects SASL/PLAIN over plaintext", () => {
		const secured = parseConsumerEnv({
			...VALID,
			KAFKA_SSL: "true",
			KAFKA_SASL_MECHANISM: "scram-sha-512",
			KAFKA_SASL_USERNAME: "consumer",
			KAFKA_SASL_PASSWORD: "kafka-secret-pw",
		});

		expect(secured.kafka.security).toEqual({ tls: { caLocation: null }, sasl: { mechanism: "scram-sha-512", username: "consumer", password: "kafka-secret-pw" } });
		expect(
			captureEnvError(() => parseConsumerEnv({ ...VALID, KAFKA_SASL_MECHANISM: "plain", KAFKA_SASL_USERNAME: "c", KAFKA_SASL_PASSWORD: "kafka-secret-pw" })).variables,
		).toEqual(["KAFKA_SASL_MECHANISM"]);
	});

	it("starts a new group from the explicit position, earliest by default", () => {
		expect(parseConsumerEnv({ ...VALID, ANALYTICS_CONSUMER_START_FROM: "latest" }).startFrom).toBe("latest");
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_CONSUMER_START_FROM: "beginning" })).variables).toEqual(["ANALYTICS_CONSUMER_START_FROM"]);
	});

	it("rejects a non-positive or non-integer shutdown timeout at boot instead of silently defaulting", () => {
		for (const value of ["-1", "0", "1.5"]) {
			expect(captureEnvError(() => parseConsumerEnv({ ...VALID, SHUTDOWN_TIMEOUT_MS: value })).variables).toEqual(["SHUTDOWN_TIMEOUT_MS"]);
		}
	});

	it("configures the pool from env and bounds its size", () => {
		const env = parseConsumerEnv({ ...VALID, ANALYTICS_DB_POOL_MAX: "12", ANALYTICS_DB_CONNECTION_TIMEOUT_MS: "2500", ANALYTICS_DB_STATEMENT_TIMEOUT_MS: "4000" });

		expect(env.dbPool).toMatchObject({ max: 12, connectionTimeoutMs: 2_500, statementTimeoutMs: 4_000 });
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_DB_POOL_MAX: "0" })).variables).toEqual(["ANALYTICS_DB_POOL_MAX"]);
	});

	it("rejects a retry delay cap below its base", () => {
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_RETRY_BASE_DELAY_MS: "2000", ANALYTICS_RETRY_MAX_DELAY_MS: "1000" })).variables).toEqual([
			"ANALYTICS_RETRY_MAX_DELAY_MS",
		]);
	});

	describe("inbox retention vs. the configured topic retention", () => {
		it("defaults to twice the configured topic retention", () => {
			expect(parseConsumerEnv({ ...VALID, KAFKA_TOPIC_RETENTION_DAYS: "30" }).inboxRetentionDays).toBe(60);
			expect(defaultInboxRetentionDays(MAX_RETENTION_DAYS)).toBe(MAX_RETENTION_DAYS);
		});

		it("accepts any window strictly longer than the topic retention", () => {
			expect(parseConsumerEnv({ ...VALID, KAFKA_TOPIC_RETENTION_DAYS: "30", ANALYTICS_INBOX_RETENTION_DAYS: "31" }).inboxRetentionDays).toBe(31);
		});

		it("fails boot for a window that does not exceed the CONFIGURED topic retention (not an assumed 7 days)", () => {
			expect(captureEnvError(() => parseConsumerEnv({ ...VALID, KAFKA_TOPIC_RETENTION_DAYS: "30", ANALYTICS_INBOX_RETENTION_DAYS: "14" })).variables).toEqual([
				"ANALYTICS_INBOX_RETENTION_DAYS",
			]);
			expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: String(DEFAULT_KAFKA_TOPIC_RETENTION_DAYS) })).variables).toEqual([
				"ANALYTICS_INBOX_RETENTION_DAYS",
			]);
			expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: "14.5" })).variables).toEqual(["ANALYTICS_INBOX_RETENTION_DAYS"]);
		});
	});

	it("bounds dead-letter retention and payload cap", () => {
		expect(parseConsumerEnv({ ...VALID, ANALYTICS_DEAD_LETTER_RETENTION_DAYS: "90" }).deadLetterRetentionDays).toBe(90);
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_DEAD_LETTER_RETENTION_DAYS: "0" })).variables).toEqual(["ANALYTICS_DEAD_LETTER_RETENTION_DAYS"]);
		expect(captureEnvError(() => parseConsumerEnv({ ...VALID, ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES: "10" })).variables).toEqual([
			"ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES",
		]);
	});
});

describe("parseTopicProvisioningEnv", () => {
	it("requires partitions and replication factor explicitly — no broker defaults", () => {
		expect(captureEnvError(() => parseTopicProvisioningEnv({ KAFKA_BROKERS: "a:9092" })).variables).toEqual(["KAFKA_TOPIC_PARTITIONS", "KAFKA_TOPIC_REPLICATION_FACTOR"]);
	});

	it("parses the topic shape and retention", () => {
		expect(
			parseTopicProvisioningEnv({ KAFKA_BROKERS: "a:9092", KAFKA_TOPIC_PARTITIONS: "6", KAFKA_TOPIC_REPLICATION_FACTOR: "3", KAFKA_TOPIC_RETENTION_DAYS: "10" }),
		).toMatchObject({
			partitions: 6,
			replicationFactor: 3,
			kafka: { topicRetentionDays: 10 },
		});
		expect(captureEnvError(() => parseTopicProvisioningEnv({ KAFKA_BROKERS: "a:9092", KAFKA_TOPIC_PARTITIONS: "0", KAFKA_TOPIC_REPLICATION_FACTOR: "1" })).variables).toEqual([
			"KAFKA_TOPIC_PARTITIONS",
		]);
	});
});

describe("parseDbLoginProvisioningEnv", () => {
	it("needs both the admin and the consumer URL", () => {
		expect(captureEnvError(() => parseDbLoginProvisioningEnv({ ANALYTICS_CONSUMER_DATABASE_URL: CONSUMER_URL })).variables).toEqual(["ANALYTICS_CONSUMER_DB_ADMIN_URL"]);
	});
});
