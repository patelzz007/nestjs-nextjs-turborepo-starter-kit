import { Admin, Consumer, MessagesStreamModes, type ConsumeOptions, type ConsumerOptions } from "@platformatic/kafka";
import {
	AggregatingKafkaLogSink,
	buildKafkaClientOptions,
	kafkaLogSinkFrom,
	observeKafkaClient,
	type KafkaBrokerFailure,
	type KafkaClientLogEntry,
	type KafkaLogSink,
	type KafkaTopicSpec,
} from "@workspace/messaging/kafka";
import { KAFKA_TOPICS, type KafkaTopic } from "@workspace/shared";

import type { ConsumerStartPosition, KafkaConnectionSettings } from "./env";
import type { ConsumerLogger, HandleOutcome } from "@workspace/messaging/inbox";

const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** The client names this worker's diagnostics carry. */
const ADMIN_NAMESPACE = "admin";
const CONSUMER_NAMESPACE = "consumer";

/** Consumer events worth a log line: a failed heartbeat (the client retries) and a lost group membership. */
export const KAFKA_HEARTBEAT_ERROR_EVENT = "consumer:heartbeat:error";
export const KAFKA_GROUP_LOST_EVENT = "consumer:group:lost";

/** What the consumer hands to a heartbeat-error or group-lost listener (the part worth logging). */
export interface KafkaConsumerFailure {
	readonly error: Error;
}

/** The consumer's own events, on top of every client's (`KafkaClientEventSource` in `@workspace/messaging/kafka`). */
export interface KafkaConsumerEventSource {
	on(event: "client:broker:failed", listener: (payload: KafkaBrokerFailure) => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	on(event: "consumer:heartbeat:error" | "consumer:group:lost", listener: (payload: KafkaConsumerFailure) => void): void;
}

/** One JSON entry per client diagnostic; an aggregated retry storm's summary adds `repeatCount` / `repeatWindowMs`. */
export function consumerLogSink(logger: ConsumerLogger): KafkaLogSink {
	return kafkaLogSinkFrom({
		error: (entry: KafkaClientLogEntry): void => {
			logger.error({ ...entry });
		},
		warn: (entry: KafkaClientLogEntry): void => {
			logger.warn({ ...entry });
		},
		info: (entry: KafkaClientLogEntry): void => {
			logger.info({ ...entry });
		},
		debug: (entry: KafkaClientLogEntry): void => {
			logger.info({ ...entry });
		},
	});
}

/**
 * Logs the consumer's group trouble on top of what every client reports: a
 * failed heartbeat (warn — the client retries, then rejoins) and a lost group
 * membership (error — its partitions go to another member until it rejoins).
 */
export function observeKafkaConsumer(consumer: KafkaConsumerEventSource, sink: KafkaLogSink): void {
	observeKafkaClient(consumer, sink, CONSUMER_NAMESPACE);
	consumer.on(KAFKA_HEARTBEAT_ERROR_EVENT, (payload: KafkaConsumerFailure): void => {
		sink.warn(payload.error.message, { namespace: CONSUMER_NAMESPACE, clientEvent: KAFKA_HEARTBEAT_ERROR_EVENT, repeats: null });
	});
	consumer.on(KAFKA_GROUP_LOST_EVENT, (payload: KafkaConsumerFailure): void => {
		sink.error(payload.error.message, { namespace: CONSUMER_NAMESPACE, clientEvent: KAFKA_GROUP_LOST_EVENT, repeats: null });
	});
}

/** The worker's Kafka clients and the log aggregation they share. */
export interface KafkaClientHandle {
	/** A new admin client; each broker request is bounded by `KAFKA_ADMIN_TIMEOUT_MS`. */
	admin(): Admin;
	/** A new consumer in `groupId` (see {@link buildConsumerOptions}). */
	consumer(groupId: string): Consumer;
	/** Emits the pending repeat counts of aggregated client diagnostics — call when the clients are done. */
	flushLogs(): void;
}

/**
 * Kafka clients (`@platformatic/kafka`) with the configured brokers, TLS / SASL
 * and the JSON logger. Repeated identical client diagnostics (a broker that is
 * down fails every reconnect) are aggregated: first line at once, then one
 * line with the repeat count per window — never dropped.
 */
export function createKafkaClient(settings: KafkaConnectionSettings, logger: ConsumerLogger): KafkaClientHandle {
	const logs = new AggregatingKafkaLogSink(consumerLogSink(logger));
	const connection = { clientId: settings.clientId, brokers: settings.brokers, security: settings.security };
	return {
		admin: (): Admin => {
			const admin = new Admin(buildKafkaClientOptions({ ...connection, requestTimeoutMs: settings.adminTimeoutMs }));
			observeKafkaClient(admin, logs, ADMIN_NAMESPACE);
			return admin;
		},
		consumer: (groupId: string): Consumer => {
			const consumer = new Consumer({ ...buildKafkaClientOptions(connection), ...buildConsumerOptions(groupId) });
			observeKafkaConsumer(consumer, logs);
			return consumer;
		},
		flushLogs: (): void => {
			logs.dispose();
		},
	};
}

/**
 * Consumer group options: offsets are committed by hand, one record at a time,
 * only after the record was handled (see {@link consumePlatformEvents}) —
 * at-least-once; the inbox makes redelivery harmless.
 */
export function buildConsumerOptions(groupId: string): Pick<ConsumerOptions<Buffer, Buffer, Buffer, Buffer>, "groupId" | "autocommit"> {
	return { groupId, autocommit: false };
}

/**
 * What to consume and from where: a group with a committed offset resumes from
 * it; `startFrom` is where a group with NO committed offset (a new group, or
 * one whose offset fell out of retention) starts — `earliest` (default)
 * consumes the retained backlog, `latest` only new records. Subscribing never
 * creates a topic (the clients run with `autocreateTopics` off).
 */
export function buildConsumeOptions(
	topics: readonly string[],
	startFrom: ConsumerStartPosition,
): Pick<ConsumeOptions<Buffer, Buffer, Buffer, Buffer>, "topics" | "mode" | "fallbackMode"> {
	return { topics: [...topics], mode: MessagesStreamModes.COMMITTED, fallbackMode: startFrom };
}

/** One record as the consumer's stream hands it over (the parts this worker uses). */
export interface KafkaConsumedRecord {
	readonly topic: string;
	readonly partition: number;
	readonly offset: bigint;
	readonly value: Buffer | null;
	/** Commits this record's offset + 1 for the group. */
	commit(): void | Promise<void>;
}

/** One record in the shape the projections take. */
export interface PlatformEventRecord {
	readonly topic: string;
	readonly partition: number;
	readonly message: { readonly offset: string; readonly value: Buffer | null };
}

/**
 * Hands every record to `handle`, in order, and commits its offset only after
 * `handle` resolved — applied, deduplicated, or durably parked. If `handle`
 * rejects (parking impossible, or shutdown interrupted it), the record is NOT
 * committed and the rejection ends the loop: the record is redelivered after
 * a restart. Returns when the stream ends (closed at shutdown).
 */
export async function consumePlatformEvents(records: AsyncIterable<KafkaConsumedRecord>, handle: (record: PlatformEventRecord) => Promise<HandleOutcome>): Promise<void> {
	for await (const record of records) {
		await handle({ topic: record.topic, partition: record.partition, message: { offset: String(record.offset), value: record.value } });
		await record.commit();
	}
}

/** Every platform topic, shaped from configuration (no broker defaults). */
export function platformTopicSpecs(partitions: number, replicationFactor: number, retentionDays: number, topics: readonly KafkaTopic[] = KAFKA_TOPICS): KafkaTopicSpec[] {
	return topics.map((topic: KafkaTopic): KafkaTopicSpec => ({ topic, partitions, replicationFactor, retentionMs: retentionDays * MS_PER_DAY }));
}

/** Thrown at boot when a subscribed topic does not exist — the consumer never creates topics. */
export class MissingKafkaTopicsError extends Error {
	public constructor(public readonly topics: readonly string[]) {
		super(`Kafka topics do not exist: ${topics.join(", ")} — provision them first (pnpm --filter @workspace/analytics-consumer kafka:provision-topics)`);
		this.name = "MissingKafkaTopicsError";
	}
}

/** The admin call {@link assertTopicsExist} needs. */
export interface KafkaTopicLister {
	listTopics(): Promise<string[]>;
}

/** Fails fast (with the provisioning hint) if any of `topics` is missing on the cluster. */
export async function assertTopicsExist(admin: KafkaTopicLister, topics: readonly string[]): Promise<void> {
	const existing: ReadonlySet<string> = new Set(await admin.listTopics());
	const missing: string[] = topics.filter((topic: string): boolean => !existing.has(topic));
	if (missing.length > 0) {
		throw new MissingKafkaTopicsError(missing);
	}
}
