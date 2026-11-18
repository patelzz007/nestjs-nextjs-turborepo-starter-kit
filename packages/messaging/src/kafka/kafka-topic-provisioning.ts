import { z } from "zod";

/**
 * Explicit topic provisioning. Clients in this repo never auto-create topics
 * (`autocreateTopics: false`): a topic auto-created by a broker gets the
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

/** One partition as the broker's metadata describes it. */
export interface KafkaPartitionMetadata {
	/** Broker id of the partition leader; negative while none is elected. */
	readonly leader: number;
	readonly replicas: readonly number[];
}

/** One topic as the broker's metadata describes it. */
export interface KafkaTopicMetadata {
	readonly partitions: readonly KafkaPartitionMetadata[];
}

/** The cluster metadata provisioning reads: every requested topic, by name. */
export interface KafkaClusterTopicsMetadata {
	readonly topics: ReadonlyMap<string, KafkaTopicMetadata>;
}

/** A topic configuration entry sent with `createTopics`. */
export interface KafkaTopicConfigEntry {
	readonly name: string;
	readonly value: string;
}

/**
 * One `createTopics` request: the topics share its configuration entries. The
 * arrays are mutable because the client's `createTopics` declares them so — a
 * readonly array would not satisfy its signature.
 */
export interface KafkaCreateTopicsRequest {
	readonly topics: { readonly topic: string; readonly partitions: number; readonly replicas: number }[];
	readonly configs: KafkaTopicConfigEntry[];
}

/** The admin calls provisioning needs (satisfied by `@platformatic/kafka`'s `Admin`). */
export interface KafkaTopicAdmin {
	listTopics(): Promise<string[]>;
	createTopics(request: KafkaCreateTopicsRequest): Promise<readonly object[]>;
	metadata(options: { readonly topics: string[]; readonly forceUpdate: boolean }): Promise<KafkaClusterTopicsMetadata>;
}

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
 * when the timeout runs out — producing to it would fail.
 */
export class KafkaTopicNotReadyError extends Error {
	public constructor(public readonly topics: readonly string[]) {
		super(`Kafka topics created but not ready (partitions without a leader): ${topics.join(", ")}`);
		this.name = "KafkaTopicNotReadyError";
	}
}

/** Thrown when the broker does not report metadata for a topic that should now exist. */
export class KafkaTopicMissingError extends Error {
	public constructor(public readonly topics: readonly string[]) {
		super(`Kafka topics missing after provisioning: ${topics.join(", ")}`);
		this.name = "KafkaTopicMissingError";
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

/**
 * How the client reports a topic the broker does not know: a `UserError`
 * ("Unknown topic <name>.") once its retries are spent, or the broker's own
 * `UNKNOWN_TOPIC_OR_PARTITION` protocol error.
 */
const UnknownTopicErrorSchema = z.union([
	z.object({ code: z.literal("PLT_KFK_USER"), message: z.string().startsWith("Unknown topic ") }),
	z.object({ apiId: z.literal("UNKNOWN_TOPIC_OR_PARTITION") }),
]);

/** A failure that wraps the errors of every attempt (the client's `MultipleErrors`). */
const AggregatedErrorsSchema = z.object({ errors: z.array(z.instanceof(Error)) });

/**
 * Whether an admin call failed because the broker does not know a topic yet.
 * Right after `createTopics`, a broker whose metadata has not caught up with the
 * controller answers a metadata read for the new topic this way instead of
 * returning it.
 */
export function isUnknownKafkaTopicError(error: Error): boolean {
	if (UnknownTopicErrorSchema.safeParse(error).success) {
		return true;
	}
	const aggregated = AggregatedErrorsSchema.safeParse(error);
	return aggregated.success && aggregated.data.errors.some((inner: Error): boolean => isUnknownKafkaTopicError(inner));
}

function minReplicationFactor(metadata: KafkaTopicMetadata): number {
	if (metadata.partitions.length === 0) {
		return 0;
	}
	return Math.min(...metadata.partitions.map((partition: KafkaPartitionMetadata): number => partition.replicas.length));
}

function findDrift(spec: KafkaTopicSpec, metadata: KafkaTopicMetadata): KafkaTopicDrift | null {
	const actualPartitions: number = metadata.partitions.length;
	const actualReplicationFactor: number = minReplicationFactor(metadata);
	if (actualPartitions >= spec.partitions && actualReplicationFactor >= spec.replicationFactor) {
		return null;
	}
	return { topic: spec.topic, expectedPartitions: spec.partitions, actualPartitions, expectedReplicationFactor: spec.replicationFactor, actualReplicationFactor };
}

/** A partition can take traffic once it has an elected leader. */
function isTopicReady(metadata: KafkaTopicMetadata | undefined): boolean {
	return metadata !== undefined && metadata.partitions.length > 0 && metadata.partitions.every((partition: KafkaPartitionMetadata): boolean => partition.leader >= 0);
}

/**
 * Reads the metadata of `topics` until every topic in `created` is ready or the
 * deadline passes. `createTopics` returns once the controller accepts the
 * request — before the new partitions have leaders, and before every broker's
 * metadata even knows the topic — so a producer that sends right after
 * provisioning would otherwise race the leader election. A read the broker
 * rejects with "unknown topic" while topics this run created are still
 * propagating counts as "not ready yet"; at the deadline it surfaces as
 * `KafkaTopicNotReadyError`. Every other error propagates at once.
 */
async function fetchMetadataOnceReady(
	admin: KafkaTopicAdmin,
	topics: readonly string[],
	created: readonly string[],
	timeoutMs: number,
	pollIntervalMs: number,
	clock: KafkaProvisioningClock,
): Promise<ReadonlyMap<string, KafkaTopicMetadata>> {
	const deadline = clock.now() + timeoutMs;
	for (;;) {
		let metadata: ReadonlyMap<string, KafkaTopicMetadata> | null = null;
		try {
			metadata = (await admin.metadata({ topics: [...topics], forceUpdate: true })).topics;
		} catch (error) {
			const propagating = created.length > 0 && error instanceof Error && isUnknownKafkaTopicError(error);
			if (!propagating) {
				throw error;
			}
			if (clock.now() >= deadline) {
				throw new KafkaTopicNotReadyError(created);
			}
		}
		if (metadata !== null) {
			const ready = created.every((topic: string): boolean => isTopicReady(metadata.get(topic)));
			if (ready || clock.now() >= deadline) {
				return metadata;
			}
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
 * `timeoutMs` bounds the wait for new topics; each broker request is bounded by
 * the admin client's own request timeout.
 */
export async function provisionKafkaTopics(
	admin: KafkaTopicAdmin,
	specs: readonly KafkaTopicSpec[],
	timeoutMs: number,
	options: KafkaTopicProvisioningOptions = {},
): Promise<KafkaTopicProvisioningResult> {
	const { pollIntervalMs = DEFAULT_KAFKA_TOPIC_READY_POLL_INTERVAL_MS, clock = SYSTEM_KAFKA_PROVISIONING_CLOCK } = options;
	const existing: ReadonlySet<string> = new Set(await admin.listTopics());
	const missing: KafkaTopicSpec[] = specs.filter((spec: KafkaTopicSpec): boolean => !existing.has(spec.topic));

	// One request per topic: a request's configuration entries apply to every topic in it, and each spec has its own retention.
	for (const spec of missing) {
		await admin.createTopics({
			topics: [{ topic: spec.topic, partitions: spec.partitions, replicas: spec.replicationFactor }],
			configs: [{ name: KAFKA_RETENTION_MS_CONFIG, value: String(spec.retentionMs) }],
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
