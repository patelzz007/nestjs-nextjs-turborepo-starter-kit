import { EventEmitter } from "node:events";

import { Admin, Producer } from "@platformatic/kafka";
import { describe, expect, it } from "vitest";

import {
	DEFAULT_KAFKA_REQUEST_TIMEOUT_MS,
	KAFKA_BROKER_FAILED_EVENT,
	KAFKA_CLIENT_ERROR_EVENT,
	KAFKA_CLIENT_RETRIES,
	KAFKA_CLIENT_RETRY_DELAY_MS,
	buildKafkaClientOptions,
	kafkaLogSinkFrom,
	observeKafkaClient,
	type KafkaClientLogEntry,
	type KafkaLogContext,
	type KafkaLogSink,
} from "../kafka-client-config";
import { KAFKA_PLAINTEXT_SECURITY, type KafkaSaslMechanism } from "../kafka-security";

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

const CA_PEM = Buffer.from("-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----\n");
const CUSTOM_REQUEST_TIMEOUT_MS = 2_000;

/** A CA reader that records which file it was asked for. */
function recordingCaReader(paths: string[]): (path: string) => Buffer {
	return (path: string): Buffer => {
		paths.push(path);
		return CA_PEM;
	};
}

describe("buildKafkaClientOptions", () => {
	it("builds plaintext options: brokers, client id, the default request timeout and explicit retries", () => {
		expect(buildKafkaClientOptions({ clientId: "api", brokers: ["a:9092", "b:9092"], security: KAFKA_PLAINTEXT_SECURITY })).toEqual({
			clientId: "api",
			bootstrapBrokers: ["a:9092", "b:9092"],
			timeout: DEFAULT_KAFKA_REQUEST_TIMEOUT_MS,
			retries: KAFKA_CLIENT_RETRIES,
			retryDelay: KAFKA_CLIENT_RETRY_DELAY_MS,
		});
	});

	it("uses the caller's request timeout when given", () => {
		expect(buildKafkaClientOptions({ clientId: "api", brokers: ["a:9092"], security: KAFKA_PLAINTEXT_SECURITY, requestTimeoutMs: CUSTOM_REQUEST_TIMEOUT_MS }).timeout).toBe(
			CUSTOM_REQUEST_TIMEOUT_MS,
		);
	});

	it("turns TLS on against the CA file, and maps each SASL mechanism to the client's name for it", () => {
		const paths: string[] = [];
		const options = buildKafkaClientOptions(
			{
				clientId: "api",
				brokers: ["broker:9093"],
				security: { tls: { caLocation: "/etc/kafka/ca.pem" }, sasl: { mechanism: "scram-sha-512", username: "api", password: "pw" } },
			},
			recordingCaReader(paths),
		);

		expect(paths).toEqual(["/etc/kafka/ca.pem"]);
		expect(options.tls).toEqual({ ca: CA_PEM });
		expect(options.sasl).toEqual({ mechanism: "SCRAM-SHA-512", username: "api", password: "pw" });
	});

	it.each<[KafkaSaslMechanism, string]>([
		["plain", "PLAIN"],
		["scram-sha-256", "SCRAM-SHA-256"],
		["scram-sha-512", "SCRAM-SHA-512"],
	])("maps SASL %s to %s", (mechanism, expected) => {
		const options = buildKafkaClientOptions({
			clientId: "api",
			brokers: ["broker:9093"],
			security: { tls: { caLocation: null }, sasl: { mechanism, username: "u", password: "p" } },
		});

		expect(options.sasl?.mechanism).toBe(expected);
	});

	it("verifies against the system trust store when TLS has no CA file — never with verification off", () => {
		const paths: string[] = [];
		const options = buildKafkaClientOptions({ clientId: "api", brokers: ["broker:9093"], security: { tls: { caLocation: null }, sasl: null } }, recordingCaReader(paths));

		expect(options.tls).toEqual({});
		expect(paths).toEqual([]);
	});

	it("is accepted by the real clients (they validate their options on construction)", async () => {
		const options = buildKafkaClientOptions({
			clientId: "api",
			brokers: ["broker:9093"],
			security: { tls: { caLocation: null }, sasl: { mechanism: "scram-sha-256", username: "api", password: "pw" } },
		});
		const admin = new Admin(options);
		const producer = new Producer({ ...options, idempotent: true, autocreateTopics: false });

		await producer.close();
		await admin.close();
		expect(admin.closed).toBe(true);
	});
});

describe("observeKafkaClient", () => {
	it("logs a broker the client could not reach as a warning, naming the broker and the client", () => {
		const lines: CapturedLine[] = [];
		const client = new EventEmitter();
		observeKafkaClient(client, capturingSink(lines), "producer");

		client.emit(KAFKA_BROKER_FAILED_EVENT, { broker: { host: "kafka-1", port: 9092 } });

		expect(lines).toEqual([
			{ level: "warn", message: "Connection to broker kafka-1:9092 failed", context: { namespace: "producer", clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: null } },
		]);
	});

	it("logs a client error instead of letting an unheard `error` event crash the process", () => {
		const lines: CapturedLine[] = [];
		const client = new EventEmitter();
		observeKafkaClient(client, capturingSink(lines), "admin");

		expect(() => client.emit(KAFKA_CLIENT_ERROR_EVENT, new Error("socket hang up"))).not.toThrow();
		expect(lines).toEqual([{ level: "error", message: "socket hang up", context: { namespace: "admin", clientEvent: KAFKA_CLIENT_ERROR_EVENT, repeats: null } }]);
	});
});

describe("kafkaLogSinkFrom", () => {
	function capturingWriters(entries: KafkaClientLogEntry[]): Record<keyof KafkaLogSink, (entry: KafkaClientLogEntry) => void> {
		const push = (entry: KafkaClientLogEntry): void => {
			entries.push(entry);
		};
		return { error: push, warn: push, info: push, debug: push };
	}

	it("writes one structured entry per diagnostic, at every level", () => {
		const entries: KafkaClientLogEntry[] = [];
		const sink = kafkaLogSinkFrom(capturingWriters(entries));
		const context: KafkaLogContext = { namespace: "consumer", clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: null };

		sink.error("e", context);
		sink.warn("w", context);
		sink.info("i", context);
		sink.debug("d", context);

		expect(entries.map((entry) => entry.message)).toEqual(["e", "w", "i", "d"]);
		expect(entries.at(0)).toEqual({ event: "kafka.client_log", namespace: "consumer", clientEvent: KAFKA_BROKER_FAILED_EVENT, message: "e" });
	});

	it("adds the repeat count and window to an aggregated summary line", () => {
		const entries: KafkaClientLogEntry[] = [];
		kafkaLogSinkFrom(capturingWriters(entries)).warn("down", { namespace: null, clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: { count: 41, windowMs: 60_000 } });

		expect(entries).toEqual([
			{ event: "kafka.client_log", namespace: null, clientEvent: KAFKA_BROKER_FAILED_EVENT, message: "down", repeatCount: 41, repeatWindowMs: 60_000 },
		]);
	});
});
