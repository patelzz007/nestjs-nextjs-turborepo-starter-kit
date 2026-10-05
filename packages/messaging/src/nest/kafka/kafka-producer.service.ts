import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { KafkaJS } from "@confluentinc/kafka-javascript";

import type { MessagingHealthIndicator } from "../../core/health";
import { buildKafkaClientConfig, kafkaLogSinkFrom, type KafkaClientLogEntry, type KafkaLogSink } from "../../kafka/kafka-client-config";
import { kafkaConnectRetryDelayMs } from "../../kafka/kafka-connect-backoff";
import { AggregatingKafkaLogSink } from "../../kafka/kafka-log-aggregator";
import { MessageEnvelopeSchema, type MessageEnvelope } from "../../schemas/outbox";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { MESSAGING_OPTIONS } from "../tokens";

/** Kafka header carrying the stable event id — lets consumers dedupe without parsing the body. */
export const KAFKA_EVENT_ID_HEADER = "event-id";

/** Kafka header carrying the event type (routing / filtering without parsing the body). */
export const KAFKA_EVENT_TYPE_HEADER = "event-type";

/** Wait for every in-sync replica before a publish counts as delivered. */
const ACKS_ALL_IN_SYNC_REPLICAS = -1;

/** Java-client-compatible key hashing, so every client maps a key to the same partition. */
const JAVA_COMPATIBLE_PARTITIONER = "murmur2_random";

/** Budget (ms) for the health probe's metadata request. */
export const KAFKA_HEALTH_PROBE_TIMEOUT_MS = 5_000;

/** Library log level: warnings and errors only (connection trouble), routed to the Nest logger. */
const CLIENT_LOG_LEVEL: KafkaJS.logLevel = KafkaJS.logLevel.WARN;

/** Backend name reported by the health indicator. */
export const KAFKA_CLIENT_BACKEND = "confluent-kafka-javascript";

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

/** The broker did not acknowledge the message (timeout, missing topic, authorization, …). */
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

/**
 * Publishes validated JSON envelopes to Kafka (Confluent client, librdkafka).
 *
 * - Boot never waits for Kafka: `onModuleInit` starts a background connect
 *   loop and returns. Each attempt needs a real metadata round trip
 *   (bounded by {@link KAFKA_HEALTH_PROBE_TIMEOUT_MS}); failures are retried
 *   with capped exponential backoff + jitter (`kafkaConnectBackoff`). Until
 *   the first success the state is `connecting`, health is DOWN with the
 *   last failure, and `publish()` rejects (the outbox keeps its rows).
 *   Shutdown cancels the loop.
 * - Idempotent producer, `acks = all`: a retried send never duplicates a
 *   record inside one producer session.
 * - Topics are never auto-created — they are provisioned explicitly.
 * - `publish()` resolves only once the broker acknowledged the record, and
 *   REJECTS with a typed error otherwise: disabled, not connected, or not
 *   acknowledged within `kafkaDeliveryTimeoutMs`. It never reports a
 *   success it did not get.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(KafkaProducerService.name);
	private producer: KafkaJS.Producer | null = null;
	private admin: KafkaJS.Admin | null = null;
	/** Collapses librdkafka retry storms; flushed (never dropped) when the client shuts down. */
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

	/** Starts the background connect loop and returns at once — an unreachable broker never blocks boot. */
	public onModuleInit(): void {
		const brokers = this.options.kafkaBrokers;
		if (brokers === undefined || this.connectLoop !== null) {
			return;
		}
		const clientLogs = new AggregatingKafkaLogSink(nestKafkaLogSink(this.logger));
		this.clientLogs = clientLogs;
		const kafka = new KafkaJS.Kafka(
			buildKafkaClientConfig({
				clientId: this.options.clientId,
				brokers,
				security: this.options.kafkaSecurity,
				log: { sink: clientLogs, level: CLIENT_LOG_LEVEL },
			}),
		);
		this.state = "connecting";
		this.connectLoop = this.connectUntilReady(kafka, brokers);
	}

	/** Cancels the connect loop (waits at most for the attempt in flight), then disconnects. */
	public async onModuleDestroy(): Promise<void> {
		if (this.state === "disabled") {
			return;
		}
		this.state = "disconnecting";
		this.shutdown.abort();
		try {
			await this.connectLoop;
			if (this.admin !== null) {
				await this.admin.disconnect();
			}
			if (this.producer !== null) {
				await this.producer.disconnect();
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

	private async connectUntilReady(kafka: KafkaJS.Kafka, brokers: readonly string[]): Promise<void> {
		const signal = this.shutdown.signal;
		while (!this.isShuttingDown()) {
			try {
				await this.attemptConnect(kafka);
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
	 * One attempt: a metadata round trip through the admin client (bounded by
	 * {@link KAFKA_HEALTH_PROBE_TIMEOUT_MS}), then the producer connect (which
	 * itself resolves only after a successful metadata request). A producer
	 * whose connect failed cannot be reused, so each attempt creates one.
	 */
	private async attemptConnect(kafka: KafkaJS.Kafka): Promise<void> {
		if (this.admin === null) {
			const admin = kafka.admin();
			await admin.connect();
			this.admin = admin;
		}
		await this.admin.listTopics({ timeout: KAFKA_HEALTH_PROBE_TIMEOUT_MS });
		if (this.isShuttingDown()) {
			return;
		}
		const producer = kafka.producer({
			kafkaJS: { idempotent: true, acks: ACKS_ALL_IN_SYNC_REPLICAS, allowAutoTopicCreation: false },
			"message.timeout.ms": this.options.kafkaDeliveryTimeoutMs,
			partitioner: JAVA_COMPATIBLE_PARTITIONER,
		});
		await producer.connect();
		this.producer = producer;
	}

	/**
	 * Publish one envelope. Resolves only after the broker acknowledged it.
	 *
	 * @throws {KafkaProducerDisabledError} no brokers configured.
	 * @throws {KafkaProducerNotConnectedError} not connected (yet / any more).
	 * @throws {KafkaPublishError} the broker did not acknowledge the record.
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
			await producer.send({
				topic,
				messages: [
					{
						key: messageKey,
						value: JSON.stringify(validated),
						headers: {
							[KAFKA_EVENT_ID_HEADER]: validated.eventId,
							[KAFKA_EVENT_TYPE_HEADER]: validated.type,
						},
					},
				],
			});
		} catch (error) {
			throw new KafkaPublishError(topic, validated.eventId, { cause: error instanceof Error ? error : new Error(String(error)) });
		}
	}

	/**
	 * Broker reachability: the producer is connected AND a metadata request
	 * answers within {@link KAFKA_HEALTH_PROBE_TIMEOUT_MS}. The failure reason
	 * is kept for the health report.
	 */
	public async ping(): Promise<KafkaPingResult> {
		const admin = this.admin;
		if (this.state !== "connected" || admin === null) {
			return { reachable: false, reason: this.lastConnectFailure === null ? `producer ${this.state}` : `producer ${this.state}: ${this.lastConnectFailure}` };
		}
		try {
			await admin.listTopics({ timeout: KAFKA_HEALTH_PROBE_TIMEOUT_MS });
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
