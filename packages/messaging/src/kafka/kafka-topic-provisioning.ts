import type { KafkaJS } from "@confluentinc/kafka-javascript";

/**
 * Explicit topic provisioning. Clients in this repo never auto-create topics
 * (`allowAutoTopicCreation: false`): a topic auto-created by a broker gets the
 * broker defaults (often 1 partition, replication factor 1), silently. Topics
 * are created up front, from configuration, by a deliberate provisioning step.
 */

/** Desired shape of one topic. */
export interface KafkaTopicSpec {
	readonly topic: string;
	readonly partitions: number;
	readonly replicationFactor: number;
	/** `retention.ms` set when the topic is created. */
	readonly retentionMs: number;
}

/** The admin calls provisioning needs (satisfied by the Confluent `KafkaJS.Admin`). */
export type KafkaTopicAdmin = Pick<KafkaJS.Admin, "listTopics" | "createTopics" | "fetchTopicMetadata">;

/** Topic config key for how long the broker keeps a record. */
export const KAFKA_RETENTION_MS_CONFIG = "retention.ms";

/** An existing topic whose shape differs from its spec. */
export interface KafkaTopicDrift {
	readonly topic: string;
	readonly expectedPartitions: number;
	readonly actualPartitions: number;
	readonly expectedReplicationFactor: number;
	/** Smallest replica count over the topic's partitions. */
	readonly actualReplicationFactor: number;
}

export interface KafkaTopicProvisioningResult {
	readonly created: readonly string[];
	readonly alreadyPresent: readonly string[];
}

/**
 * Thrown when a topic exists with fewer partitions or replicas than its spec.
 * Provisioning never changes an existing topic: adding partitions remaps keys
 * (breaking per-key ordering) and changing replication needs a reassignment —
 * both are operator decisions, so the drift is reported instead.
 */
export class KafkaTopicDriftError extends Error {
	public constructor(
		public readonly drift: readonly KafkaTopicDrift[],
		public readonly created: readonly string[],
	) {
		super(
			`Kafka topics differ from their configured shape: ${drift
				.map(
					(entry: KafkaTopicDrift): string =>
						`${entry.topic} has ${String(entry.actualPartitions)} partition(s) / replication ${String(entry.actualReplicationFactor)}, expected ${String(entry.expectedPartitions)} / ${String(entry.expectedReplicationFactor)}`,
				)
				.join("; ")}`,
		);
		this.name = "KafkaTopicDriftError";
	}
}

/** Thrown when the broker does not report metadata for a topic that should now exist. */
export class KafkaTopicMissingError extends Error {
	public constructor(public readonly topics: readonly string[]) {
		super(`Kafka topics missing after provisioning: ${topics.join(", ")}`);
		this.name = "KafkaTopicMissingError";
	}
}

function minReplicationFactor(metadata: KafkaJS.ITopicMetadata): number {
	if (metadata.partitions.length === 0) {
		return 0;
	}
	return Math.min(...metadata.partitions.map((partition: KafkaJS.PartitionMetadata): number => partition.replicas.length));
}

function findDrift(spec: KafkaTopicSpec, metadata: KafkaJS.ITopicMetadata): KafkaTopicDrift | null {
	const actualPartitions: number = metadata.partitions.length;
	const actualReplicationFactor: number = minReplicationFactor(metadata);
	if (actualPartitions >= spec.partitions && actualReplicationFactor >= spec.replicationFactor) {
		return null;
	}
	return { topic: spec.topic, expectedPartitions: spec.partitions, actualPartitions, expectedReplicationFactor: spec.replicationFactor, actualReplicationFactor };
}

/**
 * Creates every missing topic with its configured partitions, replication
 * factor and retention, then verifies every topic in `specs` against the
 * broker's metadata. Idempotent: re-running creates nothing new. A topic with
 * MORE partitions/replicas than its spec is accepted (scaled up by an operator).
 */
export async function provisionKafkaTopics(admin: KafkaTopicAdmin, specs: readonly KafkaTopicSpec[], timeoutMs: number): Promise<KafkaTopicProvisioningResult> {
	const existing: ReadonlySet<string> = new Set(await admin.listTopics({ timeout: timeoutMs }));
	const missing: KafkaTopicSpec[] = specs.filter((spec: KafkaTopicSpec): boolean => !existing.has(spec.topic));

	if (missing.length > 0) {
		await admin.createTopics({
			timeout: timeoutMs,
			topics: missing.map((spec: KafkaTopicSpec): KafkaJS.ITopicConfig => ({
				topic: spec.topic,
				numPartitions: spec.partitions,
				replicationFactor: spec.replicationFactor,
				configEntries: [{ name: KAFKA_RETENTION_MS_CONFIG, value: String(spec.retentionMs) }],
			})),
		});
	}

	const created: string[] = missing.map((spec: KafkaTopicSpec): string => spec.topic);
	const metadata: KafkaJS.ITopicMetadata[] = await admin.fetchTopicMetadata({ topics: specs.map((spec: KafkaTopicSpec): string => spec.topic), timeout: timeoutMs });
	const metadataByTopic = new Map(metadata.map((entry: KafkaJS.ITopicMetadata): [string, KafkaJS.ITopicMetadata] => [entry.name, entry]));

	const absent: string[] = [];
	const drift: KafkaTopicDrift[] = [];
	for (const spec of specs) {
		const topicMetadata = metadataByTopic.get(spec.topic);
		if (topicMetadata === undefined) {
			absent.push(spec.topic);
			continue;
		}
		const topicDrift = findDrift(spec, topicMetadata);
		if (topicDrift !== null) {
			drift.push(topicDrift);
		}
	}
	if (absent.length > 0) {
		throw new KafkaTopicMissingError(absent);
	}
	if (drift.length > 0) {
		throw new KafkaTopicDriftError(drift, created);
	}
	return { created, alreadyPresent: specs.filter((spec: KafkaTopicSpec): boolean => existing.has(spec.topic)).map((spec: KafkaTopicSpec): string => spec.topic) };
}
