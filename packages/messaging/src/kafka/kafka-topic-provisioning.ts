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

/**
 * Thrown when a topic this run created still has a partition without a leader
 * (or with a partition error) when the timeout runs out — producing to it would
 * fail with "Unknown topic or partition".
 */
export class KafkaTopicNotReadyError extends Error {
	public constructor(public readonly topics: readonly string[]) {
		super(`Kafka topics created but not ready (partitions without a leader): ${topics.join(", ")}`);
		this.name = "KafkaTopicNotReadyError";
	}
}

/** Time source for waiting on new topics; injectable so tests need no real delays. */
export interface KafkaProvisioningClock {
	now(): number;
	sleep(ms: number): Promise<void>;
}

export const SYSTEM_KAFKA_PROVISIONING_CLOCK: KafkaProvisioningClock = {
	now: (): number => Date.now(),
	sleep: (ms: number): Promise<void> =>
		new Promise<void>((resolve): void => {
			setTimeout(resolve, ms);
		}),
};

/** How often a newly created topic's metadata is re-read while waiting for its partition leaders. */
export const DEFAULT_KAFKA_TOPIC_READY_POLL_INTERVAL_MS = 100;

export interface KafkaTopicProvisioningOptions {
	readonly pollIntervalMs?: number;
	readonly clock?: KafkaProvisioningClock;
}

/** The partition error code a healthy partition reports. */
const KAFKA_NO_ERROR = 0;

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

/** A partition can take traffic once it reports no error and has an elected leader. */
function isTopicReady(metadata: KafkaJS.ITopicMetadata | undefined): boolean {
	return (
		metadata !== undefined &&
		metadata.partitions.length > 0 &&
		metadata.partitions.every((partition: KafkaJS.PartitionMetadata): boolean => partition.partitionErrorCode === KAFKA_NO_ERROR && partition.leader >= 0)
	);
}

function byTopicName(metadata: readonly KafkaJS.ITopicMetadata[]): ReadonlyMap<string, KafkaJS.ITopicMetadata> {
	return new Map(metadata.map((entry: KafkaJS.ITopicMetadata): [string, KafkaJS.ITopicMetadata] => [entry.name, entry]));
}

/**
 * Reads the metadata of `topics` until every topic in `created` is ready or the
 * deadline passes. `createTopics` returns once the controller accepts the
 * request — before the new partitions have leaders — so a producer that sends
 * right after provisioning would otherwise race the leader election.
 */
async function fetchMetadataOnceReady(
	admin: KafkaTopicAdmin,
	topics: readonly string[],
	created: readonly string[],
	timeoutMs: number,
	pollIntervalMs: number,
	clock: KafkaProvisioningClock,
): Promise<ReadonlyMap<string, KafkaJS.ITopicMetadata>> {
	const deadline = clock.now() + timeoutMs;
	for (;;) {
		const metadata = byTopicName(await admin.fetchTopicMetadata({ topics: [...topics], timeout: timeoutMs }));
		const ready = created.every((topic: string): boolean => isTopicReady(metadata.get(topic)));
		if (ready || clock.now() >= deadline) {
			return metadata;
		}
		await clock.sleep(pollIntervalMs);
	}
}

/**
 * Creates every missing topic with its configured partitions, replication
 * factor and retention, waits until the new topics' partitions have leaders,
 * then verifies every topic in `specs` against the broker's metadata.
 * Idempotent: re-running creates nothing new. A topic with MORE
 * partitions/replicas than its spec is accepted (scaled up by an operator).
 * On return, every created topic can be produced to and consumed from.
 */
export async function provisionKafkaTopics(
	admin: KafkaTopicAdmin,
	specs: readonly KafkaTopicSpec[],
	timeoutMs: number,
	options: KafkaTopicProvisioningOptions = {},
): Promise<KafkaTopicProvisioningResult> {
	const { pollIntervalMs = DEFAULT_KAFKA_TOPIC_READY_POLL_INTERVAL_MS, clock = SYSTEM_KAFKA_PROVISIONING_CLOCK } = options;
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
	const metadataByTopic = await fetchMetadataOnceReady(
		admin,
		specs.map((spec: KafkaTopicSpec): string => spec.topic),
		created,
		timeoutMs,
		pollIntervalMs,
		clock,
	);

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
	const notReady = created.filter((topic: string): boolean => !isTopicReady(metadataByTopic.get(topic)));
	if (notReady.length > 0) {
		throw new KafkaTopicNotReadyError(notReady);
	}
	return { created, alreadyPresent: specs.filter((spec: KafkaTopicSpec): boolean => existing.has(spec.topic)).map((spec: KafkaTopicSpec): string => spec.topic) };
}
