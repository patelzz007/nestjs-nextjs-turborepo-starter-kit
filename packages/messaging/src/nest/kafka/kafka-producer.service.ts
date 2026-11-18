import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Admin, ProduceAcks, Producer, compatibilityPartitioner, stringSerializers } from "@platformatic/kafka";

import type { MessagingHealthIndicator } from "../../core/health";
import {
	DEFAULT_KAFKA_REQUEST_TIMEOUT_MS,
	buildKafkaClientOptions,
	kafkaLogSinkFrom,
	observeKafkaClient,
	type KafkaClientLogEntry,
	type KafkaLogSink,
} from "../../kafka/kafka-client-config";
import { kafkaConnectRetryDelayMs } from "../../kafka/kafka-connect-backoff";
import { withKafkaDeadline } from "../../kafka/kafka-deadline";
import { AggregatingKafkaLogSink } from "../../kafka/kafka-log-aggregator";
import { MessageEnvelopeSchema, type MessageEnvelope } from "../../schemas/outbox";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { MESSAGING_OPTIONS } from "../tokens";

/** Kafka header carrying the stable event id — lets consumers dedupe without parsing the body. */
export const KAFKA_EVENT_ID_HEADER = "event-id";

/** Kafka header carrying the event type (routing / filtering without parsing the body). */
export const KAFKA_EVENT_TYPE_HEADER = "event-type";

/** Budget (ms) for the health probe's metadata request. */
export const KAFKA_HEALTH_PROBE_TIMEOUT_MS = 5_000;

/** Backend name reported by the health indicator. */
export const KAFKA_CLIENT_BACKEND = "platformatic-kafka";

/** The client names the producer's diagnostics carry. */
const PRODUCER_NAMESPACE = "producer";
const ADMIN_NAMESPACE = "admin";

/**
 * Producer lifecycle. Only `connected` can publish:
 * `disabled` (no brokers configured) and every other state fail fast.
 */
export type KafkaProducerState = "disabled" | "idle" | "connecting" | "connected" | "disconnecting" | "disconnected";

/** `publish()` on a producer whose brokers are not configured — there is nothing that could deliver the event. */
export class KafkaProducerDisabledError extends Error {
	public constructor(public readonly topic: string) {
		super(`Kafka is not configured (no brokers) — cannot publish to ${topic}`);
		this.name = "KafkaProducerDisabledError";
	}
}

/** `publish()` while the producer is not connected (before init, during or after shutdown). */
export class KafkaProducerNotConnectedError extends Error {
	public constructor(
		public readonly topic: string,
		public readonly state: KafkaProducerState,
	) {
		super(`Kafka producer is ${state}, not connected — cannot publish to ${topic}`);
		this.name = "KafkaProducerNotConnectedError";
	}
}

/** The broker did not acknowledge the message (deadline, missing topic, authorization, …). */
export class KafkaPublishError extends Error {
	public constructor(
		public readonly topic: string,
		public readonly eventId: string,
		options: { readonly cause: Error },
	) {
		super(`Kafka publish of event ${eventId} to ${topic} failed: ${options.cause.message}`, options);
		this.name = "KafkaPublishError";
	}
}

/**
 * Routes the client's own diagnostics into a Nest logger (structured, one
 * line each). A summary line of an aggregated retry storm carries
 * `repeatCount` / `repeatWindowMs`.
 */
export function nestKafkaLogSink(logger: Logger): KafkaLogSink {
	return kafkaLogSinkFrom({
		error: (entry: KafkaClientLogEntry): void => {
			logger.error(JSON.stringify(entry));
		},
		warn: (entry: KafkaClientLogEntry): void => {
			logger.warn(JSON.stringify(entry));
		},
		info: (entry: KafkaClientLogEntry): void => {
			logger.log(JSON.stringify(entry));
		},
		debug: (entry: KafkaClientLogEntry): void => {
			logger.debug(JSON.stringify(entry));
		},
	});
}

/** Resolves after `delayMs`, or as soon as `signal` aborts (shutdown) — never rejects. */
function waitOrAbort(delayMs: number, signal: AbortSignal): Promise<void> {
	return new Promise<void>((resolve): void => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const finish = (): void => {
			clearTimeout(timer);
			signal.removeEventListener("abort", finish);
			resolve();
		};
		const timer = setTimeout(finish, delayMs);
		signal.addEventListener("abort", finish, { once: true });
	});
}

/** The producer and admin clients, keyed and valued as strings. */
type StringProducer = Producer<string, string, string, string>;

/**
 * Publishes validated JSON envelopes to Kafka (`@platformatic/kafka`, pure JavaScript).
 *
 * - Boot never waits for Kafka: `onModuleInit` starts a background connect
 *   loop and returns. Each attempt needs real round trips (a topic listing
 *   through the admin client, the producer's API versions), each bounded by
 *   {@link KAFKA_HEALTH_PROBE_TIMEOUT_MS}; failures are retried with capped
 *   exponential backoff + jitter (`kafkaConnectBackoff`). Until the first
 *   success the state is `connecting`, health is DOWN with the last failure,
 *   and `publish()` rejects (the outbox keeps its rows). Shutdown cancels the loop.
 * - Idempotent producer, `acks = all`: a retried send never duplicates a
 *   record inside one producer session.
 * - Topics are never auto-created — they are provisioned explicitly.
 * - Keys map to partitions with the Java client's murmur2 hashing, so every
 *   client puts a key on the same partition.
 * - `publish()` resolves only once the broker acknowledged the record, and
 *   REJECTS with a typed error otherwise: disabled, not connected, or not
 *   acknowledged within `kafkaDeliveryTimeoutMs`. It never reports a
 *   success it did not get.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(KafkaProducerService.name);
	private producer: StringProducer | null = null;
	private admin: Admin | null = null;
	/** Collapses the client's retry storms; flushed (never dropped) when the client shuts down. */
	private clientLogs: AggregatingKafkaLogSink | null = null;
	private state: KafkaProducerState;
	/** Why the last connect attempt failed; `null` once connected. */
	private lastConnectFailure: string | null = null;
	private failedConnectAttempts = 0;
	private connectLoop: Promise<void> | null = null;
	private readonly shutdown: AbortController = new AbortController();

	public constructor(@Inject(MESSAGING_OPTIONS) private readonly options: ResolvedMessagingOptions) {
		this.state = options.kafkaBrokers === undefined ? "disabled" : "idle";
	}

	public isEnabled(): boolean {
		return this.options.kafkaBrokers !== undefined;
	}

	public getState(): KafkaProducerState {
		return this.state;
	}

	public isConnected(): boolean {
		return this.state === "connected";
	}

	/** Failed connect attempts since boot (reset once connected). */
	public getFailedConnectAttempts(): number {
		return this.failedConnectAttempts;
	}

	/** Creates the clients and starts the background connect loop, then returns at once — an unreachable broker never blocks boot. */
	public onModuleInit(): void {
		const brokers = this.options.kafkaBrokers;
		if (brokers === undefined || this.connectLoop !== null) {
			return;
		}
		const clientLogs = new AggregatingKafkaLogSink(nestKafkaLogSink(this.logger));
		this.clientLogs = clientLogs;
		// One attempt of a send never outlasts the delivery budget (the deadline in `publish` bounds the retries).
		const requestTimeoutMs = Math.min(DEFAULT_KAFKA_REQUEST_TIMEOUT_MS, this.options.kafkaDeliveryTimeoutMs);
		const connection = { clientId: this.options.clientId, brokers, security: this.options.kafkaSecurity, requestTimeoutMs };
		const producer: StringProducer = new Producer({
			...buildKafkaClientOptions(connection),
			idempotent: true,
			acks: ProduceAcks.ALL,
			autocreateTopics: false,
			partitioner: compatibilityPartitioner,
			serializers: stringSerializers,
		});
		const admin = new Admin(buildKafkaClientOptions(connection));
		observeKafkaClient(producer, clientLogs, PRODUCER_NAMESPACE);
		observeKafkaClient(admin, clientLogs, ADMIN_NAMESPACE);
		this.producer = producer;
		this.admin = admin;
		this.state = "connecting";
		this.connectLoop = this.connectUntilReady(producer, admin, brokers);
	}

	/** Cancels the connect loop (waits at most for the attempt in flight), then closes the clients. */
	public async onModuleDestroy(): Promise<void> {
		if (this.state === "disabled") {
			return;
		}
		this.state = "disconnecting";
		this.shutdown.abort();
		try {
			await this.connectLoop;
			if (this.producer !== null) {
				await this.producer.close();
			}
			if (this.admin !== null) {
				await this.admin.close();
			}
		} finally {
			this.clientLogs?.dispose();
			this.clientLogs = null;
			this.connectLoop = null;
			this.admin = null;
			this.producer = null;
			this.state = "disconnected";
		}
	}

	private async connectUntilReady(producer: StringProducer, admin: Admin, brokers: readonly string[]): Promise<void> {
		const signal = this.shutdown.signal;
		while (!this.isShuttingDown()) {
			try {
				await this.attemptConnect(producer, admin);
			} catch (error) {
				this.failedConnectAttempts += 1;
				this.lastConnectFailure = error instanceof Error ? error.message : String(error);
				const retryInMs = kafkaConnectRetryDelayMs(this.options.kafkaConnectBackoff, this.failedConnectAttempts, Math.random);
				this.logger.warn(JSON.stringify({ event: "kafka.connect_failed", attempt: this.failedConnectAttempts, retryInMs, error: this.lastConnectFailure }));
				await waitOrAbort(retryInMs, signal);
				continue;
			}
			if (!this.isShuttingDown()) {
				this.state = "connected";
				this.lastConnectFailure = null;
				this.failedConnectAttempts = 0;
				this.logger.log(JSON.stringify({ event: "kafka.producer_connected", brokers }));
			}
			return;
		}
	}

	/** Read through a method: the flag flips while the connect loop awaits. */
	private isShuttingDown(): boolean {
		return this.shutdown.signal.aborted;
	}

	/**
	 * One attempt: a topic listing through the admin client (the same probe as
	 * {@link ping}), then the producer's own API-versions round trip — so the
	 * producer's connection (and its TLS / SASL handshake) is proven, not only the admin's.
	 */
	private async attemptConnect(producer: StringProducer, admin: Admin): Promise<void> {
		await withKafkaDeadline(admin.listTopics(), "Kafka topic listing", KAFKA_HEALTH_PROBE_TIMEOUT_MS);
		if (this.isShuttingDown()) {
			return;
		}
		await withKafkaDeadline(producer.listApis(), "Kafka producer handshake", KAFKA_HEALTH_PROBE_TIMEOUT_MS);
	}

	/**
	 * Publish one envelope. Resolves only after the broker acknowledged it.
	 *
	 * @throws {KafkaProducerDisabledError} no brokers configured.
	 * @throws {KafkaProducerNotConnectedError} not connected (yet / any more).
	 * @throws {KafkaPublishError} the broker did not acknowledge the record in time.
	 */
	public async publish(topic: string, envelope: MessageEnvelope, partitionKey: string | null = null): Promise<void> {
		if (this.state === "disabled") {
			throw new KafkaProducerDisabledError(topic);
		}
		const producer = this.producer;
		if (this.state !== "connected" || producer === null) {
			throw new KafkaProducerNotConnectedError(topic, this.state);
		}
		const validated = MessageEnvelopeSchema.parse(envelope);
		const messageKey = partitionKey ?? validated.correlationId ?? validated.type;
		try {
			await withKafkaDeadline(
				producer.send({
					messages: [
						{
							topic,
							key: messageKey,
							value: JSON.stringify(validated),
							headers: {
								[KAFKA_EVENT_ID_HEADER]: validated.eventId,
								[KAFKA_EVENT_TYPE_HEADER]: validated.type,
							},
						},
					],
				}),
				`Kafka publish to ${topic}`,
				this.options.kafkaDeliveryTimeoutMs,
			);
		} catch (error) {
			throw new KafkaPublishError(topic, validated.eventId, { cause: error instanceof Error ? error : new Error(String(error)) });
		}
	}

	/**
	 * Broker reachability: the producer is connected AND a topic listing
	 * answers within {@link KAFKA_HEALTH_PROBE_TIMEOUT_MS}. The failure reason
	 * is kept for the health report.
	 */
	public async ping(): Promise<KafkaPingResult> {
		const admin = this.admin;
		if (this.state !== "connected" || admin === null) {
			return { reachable: false, reason: this.lastConnectFailure === null ? `producer ${this.state}` : `producer ${this.state}: ${this.lastConnectFailure}` };
		}
		try {
			await withKafkaDeadline(admin.listTopics(), "Kafka topic listing", KAFKA_HEALTH_PROBE_TIMEOUT_MS);
			return { reachable: true };
		} catch (error) {
			return { reachable: false, reason: error instanceof Error ? error.message : String(error) };
		}
	}
}

/** Outcome of {@link KafkaProducerService.ping}. */
export type KafkaPingResult = { readonly reachable: true } | { readonly reachable: false; readonly reason: string };

/** Health: disabled → healthy (nothing to check); enabled → connected and the broker answers. */
@Injectable()
export class KafkaHealthIndicator implements MessagingHealthIndicator {
	private lastFailure: string | null = null;

	public constructor(private readonly producer: KafkaProducerService) {}

	public async isHealthy(): Promise<boolean> {
		if (!this.producer.isEnabled()) {
			return true;
		}
		const result = await this.producer.ping();
		this.lastFailure = result.reachable ? null : result.reason;
		return result.reachable;
	}

	public getReport(): Promise<Record<string, string>> {
		if (!this.producer.isEnabled()) {
			return Promise.resolve({ backend: "disabled", brokers: "disabled", state: "disabled" });
		}
		return Promise.resolve({
			backend: KAFKA_CLIENT_BACKEND,
			brokers: "configured",
			state: this.producer.getState(),
			...(this.lastFailure === null ? {} : { lastFailure: this.lastFailure }),
		});
	}
}
