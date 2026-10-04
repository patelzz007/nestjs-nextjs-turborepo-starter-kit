import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { describe, expect, it } from "vitest";

import { KafkaTopicDriftError, KafkaTopicMissingError, provisionKafkaTopics, type KafkaTopicAdmin, type KafkaTopicSpec } from "./kafka-topic-provisioning";

const TIMEOUT_MS = 10_000;
const SEVEN_DAYS_MS = 604_800_000;

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
	) {}

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
					leader: 1,
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

		await expect(provisionKafkaTopics(admin, [spec("platform.auth")], TIMEOUT_MS)).rejects.toBeInstanceOf(KafkaTopicMissingError);
	});
});
