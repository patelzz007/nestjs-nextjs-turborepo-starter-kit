import { EnvValidationError } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	CONSUMER_ENV_SCOPE,
	DEFAULT_INBOX_RETENTION_DAYS,
	DEFAULT_SHUTDOWN_TIMEOUT_MS,
	KAFKA_DEFAULT_TOPIC_RETENTION_DAYS,
	MAX_INBOX_RETENTION_DAYS,
	MIN_INBOX_RETENTION_DAYS,
	parseConsumerEnv,
} from "./env";

const VALID = { DATABASE_URL: "postgresql://localhost/db", KAFKA_BROKERS: "a:9092" };

function captureEnvError(source: Readonly<Record<string, string | undefined>>): EnvValidationError {
	try {
		parseConsumerEnv(source);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an EnvValidationError");
}

describe("parseConsumerEnv", () => {
	it("parses the broker list and defaults the shutdown timeout and inbox retention", () => {
		expect(parseConsumerEnv({ DATABASE_URL: "postgresql://localhost/db", KAFKA_BROKERS: " a:9092, ,b:9092 " })).toEqual({
			DATABASE_URL: "postgresql://localhost/db",
			KAFKA_BROKERS: ["a:9092", "b:9092"],
			SHUTDOWN_TIMEOUT_MS: DEFAULT_SHUTDOWN_TIMEOUT_MS,
			ANALYTICS_INBOX_RETENTION_DAYS: DEFAULT_INBOX_RETENTION_DAYS,
		});
	});

	it("accepts an explicit shutdown timeout", () => {
		expect(parseConsumerEnv({ ...VALID, SHUTDOWN_TIMEOUT_MS: "2500" }).SHUTDOWN_TIMEOUT_MS).toBe(2_500);
	});

	it("ignores unrelated variables (the shared apps/api/.env and the OS environment)", () => {
		expect(parseConsumerEnv({ ...VALID, PATH: "/usr/bin", JWT_ACCESS_SECRET: "api-only" }).KAFKA_BROKERS).toEqual(["a:9092"]);
	});

	it("lists every missing variable by name in one value-free error", () => {
		const error = captureEnvError({});

		expect(error.scope).toBe(CONSUMER_ENV_SCOPE);
		expect(error.variables).toEqual(["DATABASE_URL", "KAFKA_BROKERS"]);
	});

	it("requires a postgres DATABASE_URL and never prints its credentials", () => {
		const error = captureEnvError({ ...VALID, DATABASE_URL: "mysql://root:hunter2hunter2@db/app" });

		expect(error.variables).toEqual(["DATABASE_URL"]);
		expect(error.message).not.toContain("hunter2hunter2");
	});

	it("rejects an empty broker list and brokers without a port", () => {
		expect(captureEnvError({ ...VALID, KAFKA_BROKERS: " , " }).issues[0]?.problem).toMatch(/at least one/);
		expect(captureEnvError({ ...VALID, KAFKA_BROKERS: "localhost" }).variables).toEqual(["KAFKA_BROKERS.0"]);
	});

	it("rejects a non-positive or non-integer shutdown timeout at boot instead of silently defaulting", () => {
		expect(captureEnvError({ ...VALID, SHUTDOWN_TIMEOUT_MS: "-1" }).variables).toEqual(["SHUTDOWN_TIMEOUT_MS"]);
		expect(captureEnvError({ ...VALID, SHUTDOWN_TIMEOUT_MS: "0" }).variables).toEqual(["SHUTDOWN_TIMEOUT_MS"]);
		expect(captureEnvError({ ...VALID, SHUTDOWN_TIMEOUT_MS: "1.5" }).variables).toEqual(["SHUTDOWN_TIMEOUT_MS"]);
	});
	describe("ANALYTICS_INBOX_RETENTION_DAYS", () => {
		it("defaults to twice Kafka's default topic retention", () => {
			expect(DEFAULT_INBOX_RETENTION_DAYS).toBe(KAFKA_DEFAULT_TOPIC_RETENTION_DAYS * 2);
			expect(parseConsumerEnv(VALID).ANALYTICS_INBOX_RETENTION_DAYS).toBe(DEFAULT_INBOX_RETENTION_DAYS);
		});

		it("accepts any whole number of days above the Kafka redelivery horizon", () => {
			expect(parseConsumerEnv({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: String(MIN_INBOX_RETENTION_DAYS) }).ANALYTICS_INBOX_RETENTION_DAYS).toBe(MIN_INBOX_RETENTION_DAYS);
			expect(parseConsumerEnv({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: "30" }).ANALYTICS_INBOX_RETENTION_DAYS).toBe(30);
		});

		it("fails boot for a window that does not exceed Kafka's retention, or is not a sane whole number", () => {
			expect(MIN_INBOX_RETENTION_DAYS).toBeGreaterThan(KAFKA_DEFAULT_TOPIC_RETENTION_DAYS);
			expect(captureEnvError({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: String(KAFKA_DEFAULT_TOPIC_RETENTION_DAYS) }).variables).toEqual(["ANALYTICS_INBOX_RETENTION_DAYS"]);
			expect(captureEnvError({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: "0" }).variables).toEqual(["ANALYTICS_INBOX_RETENTION_DAYS"]);
			expect(captureEnvError({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: "14.5" }).variables).toEqual(["ANALYTICS_INBOX_RETENTION_DAYS"]);
			expect(captureEnvError({ ...VALID, ANALYTICS_INBOX_RETENTION_DAYS: String(MAX_INBOX_RETENTION_DAYS + 1) }).variables).toEqual(["ANALYTICS_INBOX_RETENTION_DAYS"]);
		});
	});
});
