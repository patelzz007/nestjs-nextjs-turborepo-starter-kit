import type { EventEmitter } from "node:events";

import { compatibilityPartitioner, stringSerializers, type BaseOptions, type ProducerOptions } from "@platformatic/kafka";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_KAFKA_REQUEST_TIMEOUT_MS, KAFKA_BROKER_FAILED_EVENT, KAFKA_CLIENT_RETRIES, KAFKA_CLIENT_RETRY_DELAY_MS } from "../../../kafka/kafka-client-config";
import { DEFAULT_KAFKA_CONNECT_BACKOFF, kafkaConnectRetryDelayMs } from "../../../kafka/kafka-connect-backoff";
import { KafkaDeadlineExceededError } from "../../../kafka/kafka-deadline";
import { KAFKA_PLAINTEXT_SECURITY } from "../../../kafka/kafka-security";
import type { MessageEnvelope } from "../../../schemas/outbox";
import type { ResolvedMessagingOptions } from "../../messaging-options";
import {
	KAFKA_CLIENT_BACKEND,
	KAFKA_EVENT_ID_HEADER,
	KAFKA_EVENT_TYPE_HEADER,
	KAFKA_HEALTH_PROBE_TIMEOUT_MS,
	KafkaHealthIndicator,
	KafkaProducerDisabledError,
	KafkaProducerNotConnectedError,
	KafkaProducerService,
	KafkaPublishError,
} from "../kafka-producer.service";

interface SentMessage {
	readonly topic: string;
	readonly key: string;
	readonly value: string;
	readonly headers: Readonly<Record<string, string>>;
}

interface SentRecord {
	readonly messages: readonly SentMessage[];
}

/** Shared state the mocked client writes to and the tests steer. */
interface KafkaMockState {
	readonly sent: SentRecord[];
	readonly producerOptions: ProducerOptions<string, string, string, string>[];
	readonly adminOptions: BaseOptions[];
	/** Every client the service created, in order, to emit client events on. */
	readonly clients: EventEmitter[];
	sendFailure: Error | null;
	/** `true`: a send never settles (a broker that never acknowledges). */
	sendHangs: boolean;
	listTopicsFailure: Error | null;
	/** `true`: a topic listing never settles (a broker that accepts the connection but never answers). */
	listTopicsHangs: boolean;
	listTopicsCalls: number;
	closedClients: number;
}

const kafka = vi.hoisted((): KafkaMockState => ({
	sent: [],
	producerOptions: [],
	adminOptions: [],
	clients: [],
	sendFailure: null,
	sendHangs: false,
	listTopicsFailure: null,
	listTopicsHangs: false,
	listTopicsCalls: 0,
	closedClients: 0,
}));

vi.mock("@platformatic/kafka", async () => {
	const { EventEmitter: Emitter } = await import("node:events");

	class FakeProducer extends Emitter {
		public constructor(options: ProducerOptions<string, string, string, string>) {
			super();
			kafka.producerOptions.push(options);
			kafka.clients.push(this);
		}

		public listApis(): Promise<readonly object[]> {
			return Promise.resolve([]);
		}

		public send(record: SentRecord): Promise<object> {
			if (kafka.sendHangs) {
				return new Promise<object>(() => undefined);
			}
			if (kafka.sendFailure !== null) {
				return Promise.reject(kafka.sendFailure);
			}
			kafka.sent.push(record);
			return Promise.resolve({});
		}

		public close(): Promise<void> {
			kafka.closedClients += 1;
			return Promise.resolve();
		}
	}

	class FakeAdmin extends Emitter {
		public constructor(options: BaseOptions) {
			super();
			kafka.adminOptions.push(options);
			kafka.clients.push(this);
		}

		public listTopics(): Promise<string[]> {
			kafka.listTopicsCalls += 1;
			if (kafka.listTopicsHangs) {
				return new Promise<string[]>(() => undefined);
			}
			return kafka.listTopicsFailure === null ? Promise.resolve(["platform.sessions"]) : Promise.reject(kafka.listTopicsFailure);
		}

		public close(): Promise<void> {
			kafka.closedClients += 1;
			return Promise.resolve();
		}
	}

	return {
		Producer: FakeProducer,
		Admin: FakeAdmin,
		ProduceAcks: { ALL: -1, NO_RESPONSE: 0, LEADER: 1 },
		SASLMechanisms: { PLAIN: "PLAIN", SCRAM_SHA_256: "SCRAM-SHA-256", SCRAM_SHA_512: "SCRAM-SHA-512" },
		compatibilityPartitioner: (): number => 0,
		stringSerializers: { key: String, value: String, headerKey: String, headerValue: String },
	};
});

const DELIVERY_TIMEOUT_MS = 12_345;
/** A delivery budget shorter than one default request, so it caps the request timeout. */
const SHORT_DELIVERY_TIMEOUT_MS = 2_000;
const BROKER_FAILURE = { broker: { host: "127.0.0.1", port: 9092 } };

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

function options(kafkaBrokers: readonly string[] | undefined, kafkaDeliveryTimeoutMs = DELIVERY_TIMEOUT_MS): ResolvedMessagingOptions {
	return {
		clientId: "test",
		connectionName: "test",
		queueNames: [],
		bullPrefix: "bull",
		redisUrl: undefined,
		kafkaBrokers,
		kafkaSecurity: KAFKA_PLAINTEXT_SECURITY,
		kafkaDeliveryTimeoutMs,
		kafkaConnectBackoff: DEFAULT_KAFKA_CONNECT_BACKOFF,
		rabbitmqUrl: undefined,
		healthQueueName: undefined,
	};
}

/** Boots the producer and waits for the background connect loop to succeed. */
async function connectedProducer(deliveryTimeoutMs = DELIVERY_TIMEOUT_MS): Promise<KafkaProducerService> {
	const producer = new KafkaProducerService(options(["localhost:9092"], deliveryTimeoutMs));
	producer.onModuleInit();
	await vi.waitFor((): void => {
		expect(producer.getState()).toBe("connected");
	});
	return producer;
}

/** The producer client the service created. */
function producerClient(): EventEmitter {
	const client = kafka.clients.at(LIST_SLOT_INDEX.first);
	if (client === undefined) {
		throw new Error("the service created no Kafka client");
	}
	return client;
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
		kafka.producerOptions.length = 0;
		kafka.adminOptions.length = 0;
		kafka.clients.length = 0;
		kafka.sendFailure = null;
		kafka.sendHangs = false;
		kafka.listTopicsFailure = null;
		kafka.listTopicsHangs = false;
		kafka.listTopicsCalls = 0;
		kafka.closedClients = 0;
	});

	describe("publish", () => {
		it("sends the validated envelope with the stable event id and type as headers", async () => {
			const producer = await connectedProducer();

			await producer.publish("platform.sessions", ENVELOPE, "user-1");

			expect(kafka.sent).toEqual([
				{
					messages: [
						{
							topic: "platform.sessions",
							key: "user-1",
							value: JSON.stringify(ENVELOPE),
							headers: { [KAFKA_EVENT_ID_HEADER]: ENVELOPE.eventId, [KAFKA_EVENT_TYPE_HEADER]: "session.action" },
						},
					],
				},
			]);
		});

		it("creates an idempotent acks=all producer that never auto-creates topics and hashes keys like the Java client", async () => {
			await connectedProducer();

			expect(kafka.producerOptions).toEqual([
				{
					clientId: "test",
					bootstrapBrokers: ["localhost:9092"],
					timeout: DEFAULT_KAFKA_REQUEST_TIMEOUT_MS,
					retries: KAFKA_CLIENT_RETRIES,
					retryDelay: KAFKA_CLIENT_RETRY_DELAY_MS,
					idempotent: true,
					acks: -1,
					autocreateTopics: false,
					partitioner: compatibilityPartitioner,
					serializers: stringSerializers,
				},
			]);
		});

		it("never lets one request outlast a delivery budget shorter than the default request timeout", async () => {
			await connectedProducer(SHORT_DELIVERY_TIMEOUT_MS);

			expect(kafka.producerOptions.at(LIST_SLOT_INDEX.first)?.timeout).toBe(SHORT_DELIVERY_TIMEOUT_MS);
			expect(kafka.adminOptions.at(LIST_SLOT_INDEX.first)?.timeout).toBe(SHORT_DELIVERY_TIMEOUT_MS);
		});

		it("falls back to the correlation id as the message key", async () => {
			const producer = await connectedProducer();

			await producer.publish("platform.sessions", ENVELOPE);

			expect(kafka.sent.at(LIST_SLOT_INDEX.first)?.messages.at(LIST_SLOT_INDEX.first)?.key).toBe("corr-1");
		});

		it("falls back to the event type as the key when there is no correlation id", async () => {
			const producer = await connectedProducer();

			await producer.publish("platform.sessions", { ...ENVELOPE, correlationId: null });

			expect(kafka.sent.at(LIST_SLOT_INDEX.first)?.messages.at(LIST_SLOT_INDEX.first)?.key).toBe("session.action");
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
			expect(kafka.clients).toEqual([]);
		});

		it("fails with KafkaProducerNotConnectedError before the producer connected", async () => {
			const producer = new KafkaProducerService(options(["localhost:9092"]));

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toMatchObject({ name: "KafkaProducerNotConnectedError", state: "idle" });
			expect(kafka.sent).toEqual([]);
		});

		it("fails with KafkaProducerNotConnectedError after shutdown closed it", async () => {
			const producer = await connectedProducer();
			await producer.onApplicationShutdown();

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toBeInstanceOf(KafkaProducerNotConnectedError);
			expect(producer.isConnected()).toBe(false);
			expect(kafka.sent).toEqual([]);
			expect(kafka.closedClients).toBe(2);
		});

		it("refuses to publish with KafkaProducerNotConnectedError while the broker is unreachable (the outbox keeps the event)", async () => {
			vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			await expect(producer.publish("platform.sessions", ENVELOPE)).rejects.toMatchObject({ name: "KafkaProducerNotConnectedError", state: "connecting" });
			expect(kafka.sent).toEqual([]);
			await producer.onApplicationShutdown();
			vi.restoreAllMocks();
		});

		it("wraps a broker failure in KafkaPublishError, keeping the cause", async () => {
			const producer = await connectedProducer();
			const cause = new Error("Unknown topic platform.sessions.");
			kafka.sendFailure = cause;

			const failure = producer.publish("platform.sessions", ENVELOPE);

			await expect(failure).rejects.toBeInstanceOf(KafkaPublishError);
			await expect(failure).rejects.toMatchObject({ topic: "platform.sessions", eventId: ENVELOPE.eventId, cause });
		});

		it("fails with KafkaPublishError once the delivery budget runs out without an acknowledgement — it never waits forever", async () => {
			const producer = await connectedProducer();
			vi.useFakeTimers();
			kafka.sendHangs = true;

			const failure = producer.publish("platform.sessions", ENVELOPE);
			const assertion = expect(failure).rejects.toMatchObject({ name: "KafkaPublishError", topic: "platform.sessions" });
			await vi.advanceTimersByTimeAsync(DELIVERY_TIMEOUT_MS);

			await assertion;
			await expect(failure).rejects.toHaveProperty("cause", new KafkaDeadlineExceededError("Kafka publish to platform.sessions", DELIVERY_TIMEOUT_MS));
			vi.useRealTimers();
		});
	});

	describe("connection state and client diagnostics", () => {
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
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			expect(log.mock.calls.flat().join("\n")).not.toContain("kafka.producer_connected");
			await producer.onApplicationShutdown();
		});

		it("logs a broker that keeps failing once, then its repeat count when the client shuts down", async () => {
			const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			const producer = await connectedProducer();

			for (let attempt = 1; attempt <= 3; attempt += 1) {
				producerClient().emit(KAFKA_BROKER_FAILED_EVENT, BROKER_FAILURE);
			}
			expect(warn).toHaveBeenCalledTimes(1);

			await producer.onApplicationShutdown();

			expect(warn).toHaveBeenCalledTimes(2);
			expect(warn).toHaveBeenLastCalledWith(
				JSON.stringify({
					event: "kafka.client_log",
					namespace: "producer",
					clientEvent: KAFKA_BROKER_FAILED_EVENT,
					message: "Connection to broker 127.0.0.1:9092 failed",
					repeatCount: 2,
					repeatWindowMs: 60_000,
				}),
			);
		});

		it("logs a client error at error level instead of crashing on an unheard `error` event", async () => {
			const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
			await connectedProducer();

			producerClient().emit("error", new Error("socket hang up"));

			expect(error).toHaveBeenCalledWith(JSON.stringify({ event: "kafka.client_log", namespace: "producer", clientEvent: "error", message: "socket hang up" }));
		});

		it("flushes pending repeat counts when shutdown comes before the broker was ever reached", async () => {
			const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
			kafka.listTopicsFailure = new Error("broker unreachable");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			producerClient().emit(KAFKA_BROKER_FAILED_EVENT, BROKER_FAILURE);
			producerClient().emit(KAFKA_BROKER_FAILED_EVENT, BROKER_FAILURE);

			await producer.onApplicationShutdown();

			expect(warn.mock.calls.flat().join("\n")).toContain('"repeatCount":1');
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
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));

			producer.onModuleInit();
			// Synchronous return: boot continues before any broker round trip.
			expect(producer.getState()).toBe("connecting");
			await flushMicrotasks();

			expect(producer.getState()).toBe("connecting");
			expect(producer.getFailedConnectAttempts()).toBe(1);
			await producer.onApplicationShutdown();
		});

		it("counts a probe that never answers as a failed attempt once the probe budget runs out", async () => {
			kafka.listTopicsHangs = true;
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();

			await vi.advanceTimersByTimeAsync(KAFKA_HEALTH_PROBE_TIMEOUT_MS);

			expect(producer.getState()).toBe("connecting");
			expect(producer.getFailedConnectAttempts()).toBe(1);
			await producer.onApplicationShutdown();
		});

		it("retries with backoff and turns `connected` once the broker answers — no restart", async () => {
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			const indicator = new KafkaHealthIndicator(producer);
			producer.onModuleInit();
			await flushMicrotasks();

			await expect(indicator.isHealthy()).resolves.toBe(false);
			await expect(indicator.getReport()).resolves.toMatchObject({ state: "connecting", lastFailure: "producer connecting: Connection to broker localhost:9092 failed" });

			// Next attempt after initial delay ± jitter (≤ 1.2 s); still down → second attempt.
			await vi.advanceTimersByTimeAsync(maxDelayMs(1));
			expect(producer.getFailedConnectAttempts()).toBe(2);

			kafka.listTopicsFailure = null;
			await vi.advanceTimersByTimeAsync(maxDelayMs(2));

			expect(producer.getState()).toBe("connected");
			expect(producer.getFailedConnectAttempts()).toBe(0);
			await expect(indicator.isHealthy()).resolves.toBe(true);
			await expect(indicator.getReport()).resolves.toEqual({ backend: KAFKA_CLIENT_BACKEND, brokers: "configured", state: "connected" });
			await producer.onApplicationShutdown();
		});

		it("does not retry sooner than the backoff allows", async () => {
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();
			const callsAfterFirstAttempt = kafka.listTopicsCalls;

			await vi.advanceTimersByTimeAsync(minDelayMs(1) - 1);

			expect(kafka.listTopicsCalls).toBe(callsAfterFirstAttempt);
			await producer.onApplicationShutdown();
		});

		it("shutdown cancels the reconnect loop at once — no attempt after it", async () => {
			kafka.listTopicsFailure = new Error("Connection to broker localhost:9092 failed");
			const producer = new KafkaProducerService(options(["localhost:9092"]));
			producer.onModuleInit();
			await flushMicrotasks();

			// Resolves without advancing the (fake) clock: the backoff wait is aborted.
			await producer.onApplicationShutdown();
			const callsAtShutdown = kafka.listTopicsCalls;
			kafka.listTopicsFailure = null;
			await vi.advanceTimersByTimeAsync(DEFAULT_KAFKA_CONNECT_BACKOFF.maxDelayMs * 4);

			expect(kafka.listTopicsCalls).toBe(callsAtShutdown);
			expect(producer.getState()).toBe("disconnected");
		});
	});

	describe("health", () => {
		it("is healthy while connected and the broker answers a topic listing", async () => {
			const indicator = new KafkaHealthIndicator(await connectedProducer());

			await expect(indicator.isHealthy()).resolves.toBe(true);
			await expect(indicator.getReport()).resolves.toEqual({ backend: KAFKA_CLIENT_BACKEND, brokers: "configured", state: "connected" });
		});

		it("is unhealthy, with the reason, when the broker does not answer", async () => {
			const indicator = new KafkaHealthIndicator(await connectedProducer());
			kafka.listTopicsFailure = new Error("Request timed out");

			await expect(indicator.isHealthy()).resolves.toBe(false);
			await expect(indicator.getReport()).resolves.toMatchObject({ state: "connected", lastFailure: "Request timed out" });
		});

		it("is unhealthy when the producer is not connected", async () => {
			const producer = await connectedProducer();
			await producer.onApplicationShutdown();
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
		await expect(disabled.onApplicationShutdown()).resolves.toBeUndefined();
	});
});
