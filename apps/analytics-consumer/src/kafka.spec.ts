import { KAFKA_TOPICS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { assertTopicsExist, buildConsumerConfig, consumerLogSink, MissingKafkaTopicsError, platformTopicSpecs } from "./kafka";
import type { ConsumerLogEntry, ConsumerLogger } from "./message-handler";

const MS_PER_DAY = 86_400_000;

describe("buildConsumerConfig", () => {
	it("starts a new group from the earliest retained offset when configured (the default)", () => {
		expect(buildConsumerConfig("analytics-warehouse", "earliest")).toEqual({
			kafkaJS: { groupId: "analytics-warehouse", fromBeginning: true, allowAutoTopicCreation: false, autoCommit: true },
		});
	});

	it("only reads new records for a new group when explicitly set to latest", () => {
		expect(buildConsumerConfig("analytics-warehouse", "latest").kafkaJS?.fromBeginning).toBe(false);
	});

	it("never lets the client auto-create a topic", () => {
		expect(buildConsumerConfig("g", "earliest").kafkaJS?.allowAutoTopicCreation).toBe(false);
	});
});

describe("platformTopicSpecs", () => {
	it("shapes every platform topic from configuration — no broker defaults", () => {
		const specs = platformTopicSpecs(6, 3, 7);

		expect(specs.map((spec) => spec.topic)).toEqual(KAFKA_TOPICS);
		expect(specs[0]).toEqual({ topic: KAFKA_TOPICS[0], partitions: 6, replicationFactor: 3, retentionMs: 7 * MS_PER_DAY });
	});
});

describe("assertTopicsExist", () => {
	const admin = (topics: string[]): { listTopics: () => Promise<string[]> } => ({ listTopics: (): Promise<string[]> => Promise.resolve(topics) });

	it("passes when every topic exists", async () => {
		await expect(assertTopicsExist(admin(["a", "b", "c"]), ["a", "b"], 1_000)).resolves.toBeUndefined();
	});

	it("fails fast naming the missing topics and the provisioning command", async () => {
		const failure = assertTopicsExist(admin(["a"]), ["a", "b", "c"], 1_000);

		await expect(failure).rejects.toBeInstanceOf(MissingKafkaTopicsError);
		await expect(failure).rejects.toMatchObject({ topics: ["b", "c"] });
		await expect(failure).rejects.toThrow(/kafka:provision-topics/);
	});
});

describe("consumerLogSink", () => {
	function capturing(entries: ConsumerLogEntry[]): ConsumerLogger {
		const push = (entry: ConsumerLogEntry): void => {
			entries.push(entry);
		};
		return { info: push, warn: push, error: push };
	}

	it("writes one structured entry per client diagnostic", () => {
		const entries: ConsumerLogEntry[] = [];
		consumerLogSink(capturing(entries)).error("Connection refused", { namespace: "consumer", facility: "FAIL", repeats: null });

		expect(entries).toEqual([{ event: "kafka.client_log", namespace: "consumer", facility: "FAIL", message: "Connection refused" }]);
	});

	it("adds the repeat count and window to an aggregated summary line", () => {
		const entries: ConsumerLogEntry[] = [];
		consumerLogSink(capturing(entries)).error("Connection refused", { namespace: null, facility: "FAIL", repeats: { count: 41, windowMs: 60_000 } });

		expect(entries).toEqual([{ event: "kafka.client_log", namespace: null, facility: "FAIL", message: "Connection refused", repeatCount: 41, repeatWindowMs: 60_000 }]);
	});
});
