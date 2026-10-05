import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_KAFKA_CONNECT_BACKOFF, kafkaConnectRetryDelayMs } from "../../kafka/kafka-connect-backoff";
import { KAFKA_PLAINTEXT_SECURITY } from "../../kafka/kafka-security";
import type { MessageEnvelope } from "../../schemas/outbox";
import type { ResolvedMessagingOptions } from "../messaging-options";
import {
	KAFKA_CLIENT_BACKEND,
	KAFKA_EVENT_ID_HEADER,
	KAFKA_EVENT_TYPE_HEADER,
	KafkaHealthIndicator,
	KafkaProducerDisabledError,
	KafkaProducerNotConnectedError,
	KafkaProducerService,
	KafkaPublishError,
} from "./kafka-producer.service";

interface SentRecord {
	readonly topic: string;
	readonly messages: readonly { readonly key: string; readonly value: string; readonly headers: Readonly<Record<string, string>> }[];
}

interface FakeClient {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}

interface FakeProducer extends FakeClient {
	send(record: SentRecord): Promise<void>;
}

interface FakeAdmin extends FakeClient {
	listTopics(): Promise<string[]>;
}

/** Shared state the mocked client writes to and the tests steer. */
interface KafkaMockState {
	readonly sent: SentRecord[];
	readonly producerConfigs: KafkaJS.ProducerConstructorConfig[];
	readonly clientConfigs: KafkaJS.CommonConstructorConfig[];
	sendFailure: Error | null;
	connectFailure: Error | null;
	listTopicsFailure: Error | null;
	listTopicsCalls: number;
}

const kafka = vi.hoisted((): KafkaMockState => ({
	sent: [],
	producerConfigs: [],
	clientConfigs: [],
	sendFailure: null,
	connectFailure: null,
	listTopicsFailure: null,
	listTopicsCalls: 0,
}));

vi.mock("@confluentinc/kafka-javascript", () => ({
	KafkaJS: {
		logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },
		Kafka: class {
			public constructor(config: KafkaJS.CommonConstructorConfig) {
				kafka.clientConfigs.push(config);
			}

			public producer(config: KafkaJS.ProducerConstructorConfig): FakeProducer {
				kafka.producerConfigs.push(config);
				return {
					connect: async (): Promise<void> => (kafka.connectFailure === null ? Promise.resolve() : Promise.reject(kafka.connectFailure)),
					disconnect: async (): Promise<void> => Promise.resolve(),
					send: async (record: SentRecord): Promise<void> => {
						if (kafka.sendFailure !== null) {
							return Promise.reject(kafka.sendFailure);
						}
						kafka.sent.push(record);
						return Promise.resolve();
					},
				};
			}

			public admin(): FakeAdmin {
				return {
					connect: async (): Promise<void> => Promise.resolve(),
					disconnect: async (): Promise<void> => Promise.resolve(),
					listTopics: async (): Promise<string[]> => {
						kafka.listTopicsCalls += 1;
						return kafka.listTopicsFailure === null ? Promise.resolve(["platform.sessions"]) : Promise.reject(kafka.listTopicsFailure);
					},
				};
			}
		},
	},
}));

const DELIVERY_TIMEOUT_MS = 12_345;

/** Upper / lower jitter bound of the delay after failed attempt `attempt`. */
function maxDelayMs(attempt: number): number {
	return kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, (): number => 0.999_999);
}

function minDelayMs(attempt: number): number {
	return kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, (): number => 0);
}

const ENVELOPE: MessageEnvelope = {
	eventId: "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11",
	type: "session.action",
	correlationId: "corr-1",
	occurredAt: 1_790_812_800_000,
	payload: { userId: "user-1" },
};

function options(kafkaBrokers: readonly string[] | undefined): ResolvedMessagingOptions {
	return {
		clientId: "test",
		connectionName: "test",
		queueNames: [],
		bullPrefix: "bull",
		redisUrl: undefined,
		kafkaBrokers,
		kafkaSecurity: KAFKA_PLAINTEXT_SECURITY,
		kafkaDeliveryTimeoutMs: DELIVERY_TIMEOUT_MS,
		kafkaConnectBackoff: DEFAULT_KAFKA_CONNECT_BACKOFF,
		rabbitmqUrl: undefined,
		healthQueueName: undefined,
	};
}

/** Boots the producer and waits for the background connect loop to succeed. */
async function connectedProducer(): Promise<KafkaProducerService> {
	const producer = new KafkaProducerService(options(["localhost:9092"]));
	producer.onModuleInit();
	await vi.waitFor((): void => {
		expect(producer.getState()).toBe("connected");
	});
	return producer;
}

/** Lets pending promise callbacks run (the connect loop's awaits) without advancing timers. */
async function flushMicrotasks(): Promise<void> {
	for (let round = 0; round < 10; round += 1) {
		await Promise.resolve();
	}
}

describe("KafkaProducerService", () => {
	beforeEach(() => {
		kafka.sent.length = 0;
		kafka.producerConfigs.length = 0;
		kafka.clientConfigs.length = 0;
		kafka.sendFailure = null;
		kafka.connectFailure = null;
		kafka.listTopicsFailure = null;
		kafka.listTopicsCalls = 0;
	});

	describe("publish", () => {
		it("sends the validated envelope with the stable event id and type as headers", async () => {
			const producer = await connectedProducer();

			await producer.publish("platform.sessions", ENVELOPE, "user-1");

			expect(kafka.sent).toEqual([
				{
					topic: "platform.sessions",
					messages: [
						{
							key: "user-1",
							value: JSON.stringify(ENVELOPE),
							headers: { [KAFKA_EVENT_ID_HEADER]: ENVELOPE.eventId, [KAFKA_EVENT_TYPE_HEADER]: "session.action" },
						},
					],
				},
			]);
		});

		it("creates an idempotent acks=all producer that never auto-creates topics and bounds delivery time", async () => {
			await connectedProducer();

			expect(kafka.producerConfigs).toEqual([
				{
					kafkaJS: { idempotent: true, acks: -1, allowAutoTopicCreation: false },
					"message.timeout.ms": DELIVERY_TIMEOUT_MS,
					partitioner: "murmur2_random",
				},
			]);
		});

		it("falls back to the correlation id as the message key", async () => {
			const producer = await connectedProducer();

			await producer.publish("platform.sessions", ENVELOPE);

			expect(kafka.sent[0]?.messages[0]?.key).toBe("corr-1");
		});

		it("refuses an envelope without a uuid eventId (consumers could not dedupe it)", async () => {
			const producer = await connectedProducer();

			await expect(producer.publish("platform.sessions", { ...ENVELOPE, eventId: "not-a-uuid" })).rejects.toThrow();
			expect(kafka.sent).toEqual([]);
		});

		it("fails with KafkaProducerDisabledError when Kafka is not configured — never a silent success", async () => {
			const producer = new KafkaProducerService(options(undefined));
			producer.onModuleInit();

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toBeInstanceOf(KafkaProducerDisabledError);
			expect(producer.isEnabled()).toBe(false);
			expect(producer.getState()).toBe("disabled");
			expect(kafka.sent).toEqual([]);
		});

		it("fails with KafkaProducerNotConnectedError before the producer connected", async () => {
			const producer = new KafkaProducerService(options(["localhost:9092"]));

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toMatchObject({ name: "KafkaProducerNotConnectedError", state: "idle" });
			expect(kafka.sent).toEqual([]);
		});

		it("fails with KafkaProducerNotConnectedError after shutdown disconnected it", async () => {
			const producer = await connectedProducer();
			await producer.onModuleDestroy();

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toBeInstanceOf(KafkaProducerNotConnectedError);
			expect(producer.isConnected()).toBe(false);
			expect(kafka.sent).toEqual([]);
		});

		it("refuses to publish with KafkaProducerNotConnectedError while the broker is unreachable (the outbox keeps the event)", async () => {
			kafka.listTopicsFailure = new Error("Local: Broker transport failure");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toMatchObject({ name: "KafkaProducerNotConnectedError", state: "connecting" });
			expect(kafka.sent).toEqual([]);
			await producer.onModuleDestroy();
		});

		it("wraps a broker failure in KafkaPublishError, keeping the cause", async () => {
			const producer = await connectedProducer();
			const cause = new Error("Local: Message timed out");
			kafka.sendFailure = cause;

			const failure = producer.publish("platform.sessions", ENVELOPE);

			await expect(failure).rejects.toBeInstanceOf(KafkaPublishError);
			await expect(failure).rejects.toMatchObject({ topic: "platform.sessions", eventId: ENVELOPE.eventId, cause });
		});
	});

	describe("connection state and client diagnostics", () => {
		/** The logger the producer handed to the (mocked) client. */
		function clientLogger(): KafkaJS.Logger {
			const logger = kafka.clientConfigs.at(0)?.kafkaJS?.logger;
			if (logger === undefined) {
				throw new Error("the producer did not configure a client logger");
			}
			return logger;
		}

		const REFUSED = "127.0.0.1:9092/bootstrap: Connect to ipv4#127.0.0.1:9092 failed: Connection refused";

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("reports connected only after the client connected", async () => {
			const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

			await connectedProducer();

			expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "kafka.producer_connected", brokers: ["localhost:9092"] }));
		});

		it("never reports connected while the broker does not answer", async () => {
			const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
			vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			kafka.listTopicsFailure = new Error("all broker connections are down");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			expect(log.mock.calls.flat().join("\n")).not.toContain("kafka.producer_connected");
			await producer.onModuleDestroy();
		});

		it("pins the client to WARN, so the library's own INFO lines ('Producer connected') are not logged", async () => {
			await connectedProducer();

			expect(kafka.clientConfigs[0]?.kafkaJS?.logLevel).toBe(KafkaJS.logLevel.WARN);
		});

		it("logs a repeated connection error once, then its repeat count when the client shuts down", async () => {
			const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
			const producer = await connectedProducer();

			for (let attempt = 1; attempt <= 3; attempt += 1) {
				clientLogger().error(`${REFUSED} (after ${String(attempt)}ms in state CONNECT)`, { fac: "FAIL" });
			}
			expect(error).toHaveBeenCalledTimes(1);

			await producer.onModuleDestroy();

			expect(error).toHaveBeenCalledTimes(2);
			expect(error).toHaveBeenLastCalledWith(
				JSON.stringify({
					event: "kafka.client_log",
					namespace: null,
					facility: "FAIL",
					message: `${REFUSED} (after 1ms in state CONNECT)`,
					repeatCount: 2,
					repeatWindowMs: 60_000,
				}),
			);
		});

		it("flushes pending repeat counts when shutdown comes before the broker was ever reached", async () => {
			const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
			vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			kafka.listTopicsFailure = new Error("broker unreachable");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			clientLogger().error(REFUSED, { fac: "FAIL" });
			clientLogger().error(REFUSED, { fac: "FAIL" });

			await producer.onModuleDestroy();

			expect(error).toHaveBeenCalledTimes(2);
			expect(String(error.mock.lastCall?.[0])).toContain('"repeatCount":1');
		});
	});

	describe("background connect (boot never waits for Kafka)", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.restoreAllMocks();
		});

		it("returns from onModuleInit at once and stays `connecting` while no broker answers", async () => {
			kafka.listTopicsFailure = new Error("Local: Broker transport failure");
			const producer = new KafkaProducerService(options(["localhost:9092"]));

			producer.onModuleInit();
			// Synchronous return: boot continues before any broker round trip.
			expect(producer.getState()).toBe("connecting");
			await flushMicrotasks();

			expect(producer.getState()).toBe("connecting");
			expect(producer.getFailedConnectAttempts()).toBe(1);
			await producer.onModuleDestroy();
		});

		it("retries with backoff and turns `connected` once the broker answers — no restart", async () => {
			kafka.listTopicsFailure = new Error("Local: Broker transport failure");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			const indicator = new KafkaHealthIndicator(producer);
			producer.onModuleInit();
			await flushMicrotasks();

			await expect(indicator.isHealthy()).resolves.toBe(false);
			await expect(indicator.getReport()).resolves.toMatchObject({ state: "connecting", lastFailure: "producer connecting: Local: Broker transport failure" });

			// Next attempt after initial delay ± jitter (≤ 1.2 s); still down → second attempt.
			await vi.advanceTimersByTimeAsync(maxDelayMs(1));
			expect(producer.getFailedConnectAttempts()).toBe(2);

			kafka.listTopicsFailure = null;
			await vi.advanceTimersByTimeAsync(maxDelayMs(2));

			expect(producer.getState()).toBe("connected");
			expect(producer.getFailedConnectAttempts()).toBe(0);
			await expect(indicator.isHealthy()).resolves.toBe(true);
			await expect(indicator.getReport()).resolves.toEqual({ backend: KAFKA_CLIENT_BACKEND, brokers: "configured", state: "connected" });
			await producer.onModuleDestroy();
		});

		it("does not retry sooner than the backoff allows", async () => {
			kafka.listTopicsFailure = new Error("Local: Broker transport failure");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();
			const callsAfterFirstAttempt = kafka.listTopicsCalls;

			await vi.advanceTimersByTimeAsync(minDelayMs(1) - 1);

			expect(kafka.listTopicsCalls).toBe(callsAfterFirstAttempt);
			await producer.onModuleDestroy();
		});

		it("shutdown cancels the reconnect loop at once — no attempt after it", async () => {
			kafka.listTopicsFailure = new Error("Local: Broker transport failure");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			// Resolves without advancing the (fake) clock: the backoff wait is aborted.
			await producer.onModuleDestroy();
			const callsAtShutdown = kafka.listTopicsCalls;
			kafka.listTopicsFailure = null;
			await vi.advanceTimersByTimeAsync(DEFAULT_KAFKA_CONNECT_BACKOFF.maxDelayMs * 4);

			expect(kafka.listTopicsCalls).toBe(callsAtShutdown);
			expect(producer.getState()).toBe("disconnected");
		});
	});

	describe("health", () => {
		it("is healthy while connected and the broker answers a metadata request", async () => {
			const indicator = new KafkaHealthIndicator(await connectedProducer());

			await expect(indicator.isHealthy()).resolves.toBe(true);
			await expect(indicator.getReport()).resolves.toEqual({ backend: KAFKA_CLIENT_BACKEND, brokers: "configured", state: "connected" });
		});

		it("is unhealthy, with the reason, when the broker does not answer", async () => {
			const indicator = new KafkaHealthIndicator(await connectedProducer());
			kafka.listTopicsFailure = new Error("Local: Timed out");

			await expect(indicator.isHealthy()).resolves.toBe(false);
			await expect(indicator.getReport()).resolves.toMatchObject({ state: "connected", lastFailure: "Local: Timed out" });
		});

		it("is unhealthy when the producer is not connected", async () => {
			const producer = await connectedProducer();
			await producer.onModuleDestroy();
			const indicator = new KafkaHealthIndicator(producer);

			await expect(indicator.isHealthy()).resolves.toBe(false);
			await expect(indicator.getReport()).resolves.toMatchObject({ state: "disconnected", lastFailure: "producer disconnected" });
		});

		it("is healthy (nothing to check) when Kafka is disabled", async () => {
			const indicator = new KafkaHealthIndicator(new KafkaProducerService(options(undefined)));

			await expect(indicator.isHealthy()).resolves.toBe(true);
			await expect(indicator.getReport()).resolves.toEqual({ backend: "disabled", brokers: "disabled", state: "disabled" });
		});
	});
});

describe("KafkaProducerService without brokers", () => {
	it("refuses to publish instead of pretending the event was delivered", async () => {
		const disabled = new KafkaProducerService(options(undefined));

		await expect(disabled.publish("platform.sessions", ENVELOPE)).rejects.toBeInstanceOf(KafkaProducerDisabledError);
		expect(disabled.isEnabled()).toBe(false);
		expect(disabled.getState()).toBe("disabled");
		expect(disabled.isConnected()).toBe(false);
		await expect(disabled.ping()).resolves.toEqual({ reachable: false, reason: "producer disabled" });
	});
});
