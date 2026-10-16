import { KafkaJS } from "@confluentinc/kafka-javascript";
import { describe, expect, it } from "vitest";

import {
	KafkaTopicDriftError,
	KafkaTopicMissingError,
	KafkaTopicNotReadyError,
	provisionKafkaTopics,
	type KafkaProvisioningClock,
	type KafkaTopicAdmin,
	type KafkaTopicSpec,
} from "./kafka-topic-provisioning";

const TIMEOUT_MS = 10_000;
const SEVEN_DAYS_MS = 604_800_000;
const POLL_INTERVAL_MS = 100;
/** `leader` of a partition whose leader election has not finished. */
const NO_LEADER = -1;

/** What a broker whose metadata has not caught up yet answers a read for a just-created topic with. */
function unknownTopicError(): Error {
	return Object.assign(new Error("Broker: Unknown topic or partition"), { code: KafkaJS.ErrorCodes.ERR_UNKNOWN_TOPIC_OR_PART });
}

/** Any other broker failure. */
function brokerDownError(): Error {
	return Object.assign(new Error("Local: All broker connections are down"), { code: KafkaJS.ErrorCodes.ERR__ALL_BROKERS_DOWN });
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

interface CreateTopicsCall {
	readonly timeout?: number;
	readonly topics: KafkaJS.ITopicConfig[];
}

/** In-memory broker: topics → partition count × replication factor. */
class FakeTopicAdmin implements KafkaTopicAdmin {
	public readonly createCalls: CreateTopicsCall[] = [];

	public constructor(
		private readonly _topics: Map<string, { readonly partitions: number; readonly replicationFactor: number }>,
		private readonly _dropOnCreate = false,
		/** How many metadata reads report a just-created topic's partitions without a leader. */
		private _leaderlessReads = 0,
		/** Errors the next metadata reads reject with, one per read, before reads succeed. */
		private readonly _rejectedReads: Error[] = [],
	) {}

	public fetchCount = 0;

	public listTopics(): Promise<string[]> {
		return Promise.resolve([...this._topics.keys()]);
	}

	public createTopics(call: CreateTopicsCall): Promise<boolean> {
		this.createCalls.push(call);
		if (!this._dropOnCreate) {
			for (const topic of call.topics) {
				this._topics.set(topic.topic, { partitions: topic.numPartitions ?? 1, replicationFactor: topic.replicationFactor ?? 1 });
			}
		}
		return Promise.resolve(true);
	}

	public fetchTopicMetadata(options?: { readonly topics?: string[] }): Promise<KafkaJS.ITopicMetadata[]> {
		this.fetchCount += 1;
		const rejection = this._rejectedReads.shift();
		if (rejection !== undefined) {
			return Promise.reject(rejection);
		}
		const leader = this._leaderlessReads > 0 ? NO_LEADER : 1;
		this._leaderlessReads = Math.max(0, this._leaderlessReads - 1);
		const names = options?.topics ?? [...this._topics.keys()];
		const metadata: KafkaJS.ITopicMetadata[] = [];
		for (const name of names) {
			const topic = this._topics.get(name);
			if (topic === undefined) {
				continue;
			}
			metadata.push({
				name,
				partitions: Array.from({ length: topic.partitions }, (_: undefined, partitionId: number): KafkaJS.PartitionMetadata => ({
					partitionErrorCode: 0,
					partitionId,
					leader,
					replicas: Array.from({ length: topic.replicationFactor }, (__: undefined, replica: number): number => replica + 1),
					isr: [1],
				})),
			});
		}
		return Promise.resolve(metadata);
	}
}

function spec(topic: string): KafkaTopicSpec {
	return { topic, partitions: 6, replicationFactor: 3, retentionMs: SEVEN_DAYS_MS };
}

describe("provisionKafkaTopics", () => {
	it("creates only the missing topics with the configured partitions, replication and retention", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]));

		const result = await provisionKafkaTopics(admin, [spec("platform.auth"), spec("platform.email")], TIMEOUT_MS);

		expect(result).toEqual({ created: ["platform.email"], alreadyPresent: ["platform.auth"] });
		expect(admin.createCalls).toEqual([
			{
				timeout: TIMEOUT_MS,
				topics: [{ topic: "platform.email", numPartitions: 6, replicationFactor: 3, configEntries: [{ name: "retention.ms", value: String(SEVEN_DAYS_MS) }] }],
			},
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
		expect(admin.fetchCount).toBe(leaderlessReads + 1);
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
		expect(admin.fetchCount).toBe(unknownReads + 1);
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
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]), false, 0, [unknownTopicError()]);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).rejects.toMatchObject({ code: KafkaJS.ErrorCodes.ERR_UNKNOWN_TOPIC_OR_PART });
		expect(clock.sleeps).toEqual([]);
	});

	it("propagates any other broker error at once instead of polling through it", async () => {
		const admin = new FakeTopicAdmin(new Map(), false, 0, [brokerDownError()]);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).rejects.toMatchObject({ code: KafkaJS.ErrorCodes.ERR__ALL_BROKERS_DOWN });
		expect(clock.sleeps).toEqual([]);
	});

	it("does not wait on topics that already existed", async () => {
		const admin = new FakeTopicAdmin(new Map([["platform.auth", { partitions: 6, replicationFactor: 3 }]]), false, Number.MAX_SAFE_INTEGER);
		const clock = new FakeClock();

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS, { clock })).resolves.toEqual({ created: [], alreadyPresent: ["platform.auth"] });
		expect(clock.sleeps).toEqual([]);
	});
});
