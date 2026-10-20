import { KafkaJS } from "@confluentinc/kafka-javascript";
import {
	AggregatingKafkaLogSink,
	buildKafkaClientConfig,
	kafkaLogSinkFrom,
	type KafkaClientLogEntry,
	type KafkaLogSink,
	type KafkaTopicSpec,
} from "@workspace/messaging/kafka";
import { KAFKA_TOPICS, type KafkaTopic } from "@workspace/shared";

import type { ConsumerStartPosition, KafkaConnectionSettings } from "./env";
import type { ConsumerLogger } from "@workspace/messaging/inbox";

const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** Library log level: warnings and errors (connection, rebalance and commit trouble). */
const CLIENT_LOG_LEVEL: KafkaJS.logLevel = KafkaJS.logLevel.WARN;

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

/** A Kafka client and the log aggregation it owns. */
export interface KafkaClientHandle {
	readonly kafka: KafkaJS.Kafka;
	/** Emits the pending repeat counts of aggregated client diagnostics — call when the client is done. */
	flushLogs(): void;
}

/**
 * Confluent client (librdkafka) with the configured brokers, TLS / SASL, and
 * the JSON logger. Repeated identical client diagnostics (a broker that is
 * down fails every reconnect) are aggregated: first line at once, then one
 * line with the repeat count per window — never dropped.
 */
export function createKafkaClient(settings: KafkaConnectionSettings, logger: ConsumerLogger): KafkaClientHandle {
	const logs = new AggregatingKafkaLogSink(consumerLogSink(logger));
	const kafka = new KafkaJS.Kafka(
		buildKafkaClientConfig({
			clientId: settings.clientId,
			brokers: settings.brokers,
			security: settings.security,
			log: { sink: logs, level: CLIENT_LOG_LEVEL },
		}),
	);
	return {
		kafka,
		flushLogs: (): void => {
			logs.dispose();
		},
	};
}

/**
 * Consumer group config:
 * - `fromBeginning` = where a group with NO committed offset (a new group,
 *   or one whose offset fell out of retention) starts: `earliest` (default)
 *   consumes the retained backlog, `latest` only new records. A group with a
 *   committed offset always resumes from it;
 * - no topic auto-creation (topics are provisioned explicitly);
 * - offsets are stored only after `eachMessage` resolves and committed
 *   periodically — at-least-once; the inbox makes redelivery harmless.
 */
export function buildConsumerConfig(groupId: string, startFrom: ConsumerStartPosition): KafkaJS.ConsumerConstructorConfig {
	return {
		kafkaJS: {
			groupId,
			fromBeginning: startFrom === "earliest",
			allowAutoTopicCreation: false,
			autoCommit: true,
		},
	};
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

/** Fails fast (with the provisioning hint) if any of `topics` is missing on the cluster. */
export async function assertTopicsExist(admin: Pick<KafkaJS.Admin, "listTopics">, topics: readonly string[], timeoutMs: number): Promise<void> {
	const existing: ReadonlySet<string> = new Set(await admin.listTopics({ timeout: timeoutMs }));
	const missing: string[] = topics.filter((topic: string): boolean => !existing.has(topic));
	if (missing.length > 0) {
		throw new MissingKafkaTopicsError(missing);
	}
}
