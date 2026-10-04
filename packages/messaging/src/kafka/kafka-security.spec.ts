import { describe, expect, it } from "vitest";

import { InvalidKafkaSecurityEnvError, KafkaSecurityEnvSchema, listKafkaSecurityEnvIssues, toKafkaSecurityOptions, type KafkaSecurityEnv } from "./kafka-security";

function parse(source: Readonly<Record<string, string>>): KafkaSecurityEnv {
	return KafkaSecurityEnvSchema.parse(source);
}

describe("KafkaSecurityEnvSchema", () => {
	it("defaults to plaintext without SASL", () => {
		const env = parse({});

		expect(env.KAFKA_SSL).toBe(false);
		expect(toKafkaSecurityOptions(env)).toEqual({ tls: null, sasl: null });
	});

	it("rejects a flag that is not exactly true/false and an unknown SASL mechanism", () => {
		expect(KafkaSecurityEnvSchema.safeParse({ KAFKA_SSL: "yes" }).success).toBe(false);
		expect(KafkaSecurityEnvSchema.safeParse({ KAFKA_SASL_MECHANISM: "gssapi" }).success).toBe(false);
	});
});

describe("toKafkaSecurityOptions", () => {
	it("maps TLS with a CA file and SCRAM credentials", () => {
		const env = parse({
			KAFKA_SSL: "true",
			KAFKA_SSL_CA_LOCATION: "/etc/kafka/ca.pem",
			KAFKA_SASL_MECHANISM: "scram-sha-512",
			KAFKA_SASL_USERNAME: "api",
			KAFKA_SASL_PASSWORD: "s3cret-pass",
		});

		expect(toKafkaSecurityOptions(env)).toEqual({
			tls: { caLocation: "/etc/kafka/ca.pem" },
			sasl: { mechanism: "scram-sha-512", username: "api", password: "s3cret-pass" },
		});
	});

	it("uses the system trust store when TLS is on without a CA file", () => {
		expect(toKafkaSecurityOptions(parse({ KAFKA_SSL: "true" })).tls).toEqual({ caLocation: null });
	});

	it("throws a value-free error on an inconsistent combination", () => {
		const env = parse({ KAFKA_SASL_MECHANISM: "scram-sha-256", KAFKA_SASL_PASSWORD: "hunter2hunter2" });

		expect(() => toKafkaSecurityOptions(env)).toThrow(InvalidKafkaSecurityEnvError);
		expect(() => toKafkaSecurityOptions(env)).not.toThrow(/hunter2hunter2/);
	});
});

describe("listKafkaSecurityEnvIssues", () => {
	it("requires username and password once a mechanism is chosen", () => {
		expect(listKafkaSecurityEnvIssues(parse({ KAFKA_SASL_MECHANISM: "scram-sha-512" })).map((issue) => issue.variable)).toEqual([
			"KAFKA_SASL_USERNAME",
			"KAFKA_SASL_PASSWORD",
		]);
	});

	it("refuses SASL/PLAIN over plaintext (the password would cross the network in clear)", () => {
		const issues = listKafkaSecurityEnvIssues(parse({ KAFKA_SASL_MECHANISM: "plain", KAFKA_SASL_USERNAME: "api", KAFKA_SASL_PASSWORD: "pw-123456" }));

		expect(issues.map((issue) => issue.variable)).toEqual(["KAFKA_SASL_MECHANISM"]);
		expect(listKafkaSecurityEnvIssues(parse({ KAFKA_SSL: "true", KAFKA_SASL_MECHANISM: "plain", KAFKA_SASL_USERNAME: "api", KAFKA_SASL_PASSWORD: "pw-123456" }))).toEqual([]);
	});

	it("flags settings that would be silently ignored", () => {
		expect(
			listKafkaSecurityEnvIssues(parse({ KAFKA_SASL_USERNAME: "api", KAFKA_SASL_PASSWORD: "pw-123456", KAFKA_SSL_CA_LOCATION: "/ca.pem" })).map((issue) => issue.variable),
		).toEqual(["KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD", "KAFKA_SSL_CA_LOCATION"]);
	});
});
