import { MultipleErrors, NetworkError, ProtocolError, UserError } from "@platformatic/kafka";
import { describe, expect, it } from "vitest";

import {
	KafkaTopicDriftError,
	KafkaTopicMissingError,
	KafkaTopicNotReadyError,
	isUnknownKafkaTopicError,
	provisionKafkaTopics,
	type KafkaClusterTopicsMetadata,
	type KafkaCreateTopicsRequest,
	type KafkaPartitionMetadata,
	type KafkaProvisioningClock,
	type KafkaTopicAdmin,
	type KafkaTopicMetadata,
	type KafkaTopicSpec,
} from "../kafka-topic-provisioning";

const TIMEOUT_MS = 10_000;
const SEVEN_DAYS_MS = 604_800_000;
const ONE_DAY_MS = 86_400_000;
const POLL_INTERVAL_MS = 100;
/** `leader` of a partition whose leader election has not finished. */
const NO_LEADER = -1;

/** What the client rejects a metadata read with when the broker does not know the topic (yet). */
function unknownTopicError(): Error {
	return new UserError("Unknown topic platform.auth.");
}

/** Any other broker failure. */
function brokerDownError(): Error {
	return new NetworkError("Connection to broker kafka-1:9092 failed");
}

/** Advances only when slept on — waiting costs no real time. */
class FakeClock implements KafkaProvisioningClock {
	public readonly sleeps: number[] = [];
	private _now = 0;

	public now(): number {
		return this._now;
	}

	public sleep(ms: number): Promise<void> {
		this.sleeps.push(ms);
		this._now += ms;
		return Promise.resolve();
	}
}

/** In-memory broker: topics → partition count × replication factor. */
class FakeTopicAdmin implements KafkaTopicAdmin {
	public readonly createCalls: KafkaCreateTopicsRequest[] = [];
	public metadataReads = 0;

	public constructor(
		private readonly _topics: Map<string, { readonly partitions: number; readonly replicationFactor: number }>,
		private readonly _dropOnCreate = false,
		/** How many metadata reads report a just-created topic's partitions without a leader. */
		private _leaderlessReads = 0,
		/** Errors the next metadata reads reject with, one per read, before reads succeed. */
		private readonly _rejectedReads: Error[] = [],
	) {}

	public listTopics(): Promise<string[]> {
		return Promise.resolve([...this._topics.keys()]);
	}

	public createTopics(request: KafkaCreateTopicsRequest): Promise<readonly object[]> {
		this.createCalls.push(request);
		if (!this._dropOnCreate) {
			for (const topic of request.topics) {
				this._topics.set(topic.topic, { partitions: topic.partitions, replicationFactor: topic.replicas });
			}
		}
		return Promise.resolve(request.topics);
	}

	public metadata(options: { readonly topics: string[]; readonly forceUpdate: boolean }): Promise<KafkaClusterTopicsMetadata> {
		this.metadataReads += 1;
		const rejection = this._rejectedReads.shift();
		if (rejection !== undefined) {
			return Promise.reject(rejection);
		}
		const leader = this._leaderlessReads > 0 ? NO_LEADER : 1;
		this._leaderlessReads = Math.max(0, this._leaderlessReads - 1);
		const topics = new Map<string, KafkaTopicMetadata>();
		for (const name of options.topics) {
			const topic = this._topics.get(name);
			if (topic !== undefined) {
				topics.set(name, {
					partitions: Array.from({ length: topic.partitions }, (): KafkaPartitionMetadata => ({
						leader,
						replicas: Array.from({ length: topic.replicationFactor }, (_: undefined, replica: number): number => replica + 1),
					})),
				});
			}
		}
		return Promise.resolve({ topics });
	}
}

function spec(topic: string, retentionMs = SEVEN_DAYS_MS): KafkaTopicSpec {
	return { topic, partitions: 6, replicationFactor: 3, retentionMs };
}

describe("provisionKafkaTopics", () => {
	it("creates only the missing topics, each in its own request with its partitions, replication and retention", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]));

		const result = await provisionKafkaTopics(admin, [spec("platform.auth"), spec("platform.email"), spec("platform.sessions", ONE_DAY_MS)], TIMEOUT_MS);

		expect(result).toEqual({ created: ["platform.email", "platform.sessions"], alreadyPresent: ["platform.auth"] });
		expect(admin.createCalls).toEqual([
			{ topics: [{ topic: "platform.email", partitions: 6, replicas: 3 }], configs: [{ name: "retention.ms", value: String(SEVEN_DAYS_MS) }] },
			{ topics: [{ topic: "platform.sessions", partitions: 6, replicas: 3 }], configs: [{ name: "retention.ms", value: String(ONE_DAY_MS) }] },
		]);
	});

	it("is idempotent: a second run creates nothing", async () => {
		const admin = new FakeTopicAdmin(new Map());
		await provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS);

		const second = await provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS);

		expect(second).toEqual({ created: [], alreadyPresent: ["platform.auth"] });
		expect(admin.createCalls).toHaveLength(1);
	});

	it("accepts a topic an operator scaled beyond its spec", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 12, replicationFactor: 3 }]]));

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS)).resolves.toEqual({ created: [], alreadyPresent: ["platform.auth"] });
	});

	it("reports (never silently accepts or rewrites) a topic auto-created with broker defaults", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 1, replicationFactor: 1 }]]));

		const failure = provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS);

		await expect(failure).rejects.toBeInstanceOf(KafkaTopicDriftError);
		await expect(failure).rejects.toMatchObject({
			drift: [{ topic: "platform.auth", expectedPartitions: 6, actualPartitions: 1, expectedReplicationFactor: 3, actualReplicationFactor: 1 }],
		});
		expect(admin.createCalls).toEqual([]);
	});

	it("reports a topic without partitions as drift, with no replicas", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 0, replicationFactor: 3 }]]));

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS)).rejects.toMatchObject({ drift: [{ actualPartitions: 0, actualReplicationFactor: 0 }] });
	});

	it("fails when the broker does not report a topic it was asked to create", async () => {
		const admin = new FakeTopicAdmin(new Map(), true);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock, pollIntervalMs: POLL_INTERVAL_MS })).rejects.toBeInstanceOf(KafkaTopicMissingError);
		expect(clock.now()).toBeGreaterThanOrEqual(TIMEOUT_MS);
	});

	it("returns only once a created topic's partitions have leaders, so a producer can send at once", async () => {
		const leaderlessReads = 3;
		const admin = new FakeTopicAdmin(new Map(), false, leaderlessReads);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock, pollIntervalMs: POLL_INTERVAL_MS })).resolves.toEqual({
			created: ["platform.auth"],
			alreadyPresent: [],
		});
		expect(admin.metadataReads).toBe(leaderlessReads + 1);
		expect(clock.sleeps).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
	});

	it("fails when a created topic still has no partition leaders at the timeout", async () => {
		const admin = new FakeTopicAdmin(new Map(), false, Number.MAX_SAFE_INTEGER);
		const clock = new FakeClock();

		const failure = provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock, pollIntervalMs: POLL_INTERVAL_MS });

		await expect(failure).rejects.toBeInstanceOf(KafkaTopicNotReadyError);
		await expect(failure).rejects.toMatchObject({ topics: ["platform.auth"] });
	});

	it("keeps polling while the broker does not know a just-created topic yet, then returns once it is ready", async () => {
		const unknownReads = 2;
		const admin = new FakeTopicAdmin(new Map(), false, 0, Array.from({ length: unknownReads }, unknownTopicError));
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock, pollIntervalMs: POLL_INTERVAL_MS })).resolves.toEqual({
			created: ["platform.auth"],
			alreadyPresent: [],
		});
		expect(admin.metadataReads).toBe(unknownReads + 1);
		expect(clock.sleeps).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
	});

	it("reports a just-created topic the broker never learns of as not ready at the timeout", async () => {
		const readsUntilTimeout = TIMEOUT_MS / POLL_INTERVAL_MS + 1;
		const admin = new FakeTopicAdmin(new Map(), false, 0, Array.from({ length: readsUntilTimeout }, unknownTopicError));
		const clock = new FakeClock();

		const failure = provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock, pollIntervalMs: POLL_INTERVAL_MS });

		await expect(failure).rejects.toBeInstanceOf(KafkaTopicNotReadyError);
		await expect(failure).rejects.toMatchObject({ topics: ["platform.auth"] });
	});

	it("does not mask an unknown-topic error when it created nothing — an existing topic the broker cannot find is a real failure", async () => {
		const missing = unknownTopicError();
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]), false, 0, [missing]);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).rejects.toBe(missing);
		expect(clock.sleeps).toEqual([]);
	});

	it("propagates any other broker error at once instead of polling through it", async () => {
		const down = brokerDownError();
		const admin = new FakeTopicAdmin(new Map(), false, 0, [down]);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).rejects.toBe(down);
		expect(clock.sleeps).toEqual([]);
	});

	it("does not wait on topics that already existed", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]), false, Number.MAX_SAFE_INTEGER);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).resolves.toEqual({ created: [], alreadyPresent: ["platform.auth"] });
		expect(clock.sleeps).toEqual([]);
	});
});

describe("isUnknownKafkaTopicError", () => {
	it("recognises the client's own 'Unknown topic' error", () => {
		expect(isUnknownKafkaTopicError(unknownTopicError())).toBe(true);
	});

	it("recognises the broker's UNKNOWN_TOPIC_OR_PARTITION protocol error", () => {
		expect(isUnknownKafkaTopicError(new ProtocolError("UNKNOWN_TOPIC_OR_PARTITION"))).toBe(true);
	});

	it("looks inside a failure that wraps every attempt's error", () => {
		expect(isUnknownKafkaTopicError(new MultipleErrors("Request failed", [brokerDownError(), unknownTopicError()]))).toBe(true);
	});

	it("does not take another failure for an unknown topic", () => {
		expect(isUnknownKafkaTopicError(brokerDownError())).toBe(false);
		expect(isUnknownKafkaTopicError(new UserError("Invalid partition"))).toBe(false);
		expect(isUnknownKafkaTopicError(new MultipleErrors("Request failed", [brokerDownError()]))).toBe(false);
	});
});
