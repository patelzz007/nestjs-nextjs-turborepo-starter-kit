import { EventEmitter } from "node:events";

import { LIST_SLOT_INDEX, KAFKA_TOPICS } from "@workspace/shared";
import { KAFKA_BROKER_FAILED_EVENT, KAFKA_PLAINTEXT_SECURITY } from "@workspace/messaging/kafka";
import { describe, expect, it } from "vitest";

import {
	KAFKA_GROUP_LOST_EVENT,
	KAFKA_HEARTBEAT_ERROR_EVENT,
	MissingKafkaTopicsError,
	assertTopicsExist,
	buildConsumeOptions,
	buildConsumerOptions,
	consumePlatformEvents,
	consumerLogSink,
	createKafkaClient,
	observeKafkaConsumer,
	platformTopicSpecs,
	type KafkaConsumedRecord,
	type PlatformEventRecord,
} from "../kafka";
import type { ConsumerLogEntry, ConsumerLogger, HandleOutcome } from "@workspace/messaging/inbox";

const MS_PER_DAY = 86_400_000;
const ADMIN_TIMEOUT_MS = 2_000;

function capturing(entries: ConsumerLogEntry[]): ConsumerLogger {
	const push = (entry: ConsumerLogEntry): void => {
		entries.push(entry);
	};
	return { info: push, warn: push, error: push };
}

describe("buildConsumerOptions", () => {
	it("joins the group with auto-commit off — offsets are committed one record at a time, after it was handled", () => {
		expect(buildConsumerOptions("analytics-warehouse")).toEqual({ groupId: "analytics-warehouse", autocommit: false });
	});
});

describe("buildConsumeOptions", () => {
	it("resumes from the committed offset, and starts a new group from the earliest retained record when configured (the default)", () => {
		expect(buildConsumeOptions(["platform.auth"], "earliest")).toEqual({ topics: ["platform.auth"], mode: "committed", fallbackMode: "earliest" });
	});

	it("only reads new records for a new group when explicitly set to latest", () => {
		expect(buildConsumeOptions(["platform.auth"], "latest").fallbackMode).toBe("latest");
	});
});

describe("platformTopicSpecs", () => {
	it("shapes every platform topic from configuration — no broker defaults", () => {
		const specs = platformTopicSpecs(6, 3, 7);

		expect(specs.map((spec) => spec.topic)).toEqual(KAFKA_TOPICS);
		expect(specs.at(LIST_SLOT_INDEX.first)).toEqual({ topic: KAFKA_TOPICS.at(LIST_SLOT_INDEX.first), partitions: 6, replicationFactor: 3, retentionMs: 7 * MS_PER_DAY });
	});
});

describe("assertTopicsExist", () => {
	const admin = (topics: string[]): { listTopics: () => Promise<string[]> } => ({ listTopics: (): Promise<string[]> => Promise.resolve(topics) });

	it("passes when every topic exists", async () => {
		await expect(assertTopicsExist(admin(["a", "b", "c"]), ["a", "b"])).resolves.toBeUndefined();
	});

	it("fails fast naming the missing topics and the provisioning command", async () => {
		const failure = assertTopicsExist(admin(["a"]), ["a", "b", "c"]);

		await expect(failure).rejects.toBeInstanceOf(MissingKafkaTopicsError);
		await expect(failure).rejects.toMatchObject({ topics: ["b", "c"] });
		await expect(failure).rejects.toThrow(/kafka:provision-topics/);
	});
});

describe("consumePlatformEvents", () => {
	const PROCESSED: HandleOutcome = { kind: "processed", eventId: "e", attempts: 1 };

	/** A record that notes, in `log`, when its offset was committed. */
	function record(offset: bigint, log: string[]): KafkaConsumedRecord {
		return {
			topic: "platform.auth",
			partition: 2,
			offset,
			value: Buffer.from(`value-${String(offset)}`),
			commit: (): Promise<void> => {
				log.push(`commit ${String(offset)}`);
				return Promise.resolve();
			},
		};
	}

	async function* stream(records: readonly KafkaConsumedRecord[]): AsyncGenerator<KafkaConsumedRecord> {
		for (const item of records) {
			yield await Promise.resolve(item);
		}
	}

	it("hands each record over in order, and commits its offset only after the handler resolved", async () => {
		const log: string[] = [];
		const handled: PlatformEventRecord[] = [];

		await consumePlatformEvents(stream([record(7n, log), record(8n, log)]), (delivery: PlatformEventRecord): Promise<HandleOutcome> => {
			handled.push(delivery);
			log.push(`handle ${delivery.message.offset}`);
			return Promise.resolve(PROCESSED);
		});

		expect(log).toEqual(["handle 7", "commit 7", "handle 8", "commit 8"]);
		expect(handled.at(LIST_SLOT_INDEX.first)).toEqual({ topic: "platform.auth", partition: 2, message: { offset: "7", value: Buffer.from("value-7") } });
	});

	it("leaves a record whose handler failed uncommitted, and stops — it is redelivered after a restart", async () => {
		const log: string[] = [];
		const failure = new Error("could not park the record");

		await expect(
			consumePlatformEvents(stream([record(7n, log), record(8n, log)]), (delivery: PlatformEventRecord): Promise<HandleOutcome> => {
				log.push(`handle ${delivery.message.offset}`);
				return Promise.reject(failure);
			}),
		).rejects.toBe(failure);
		expect(log).toEqual(["handle 7"]);
	});
});

describe("consumerLogSink", () => {
	it("writes one structured entry per client diagnostic", () => {
		const entries: ConsumerLogEntry[] = [];
		consumerLogSink(capturing(entries)).error("Connection refused", { namespace: "consumer", clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: null });

		expect(entries).toEqual([{ event: "kafka.client_log", namespace: "consumer", clientEvent: KAFKA_BROKER_FAILED_EVENT, message: "Connection refused" }]);
	});

	it("writes debug lines at info level (the JSON logger has no debug)", () => {
		const entries: ConsumerLogEntry[] = [];
		consumerLogSink(capturing(entries)).debug("fetch", { namespace: null, clientEvent: null, repeats: null });

		expect(entries).toEqual([{ event: "kafka.client_log", namespace: null, clientEvent: null, message: "fetch" }]);
	});

	it("adds the repeat count and window to an aggregated summary line", () => {
		const entries: ConsumerLogEntry[] = [];
		consumerLogSink(capturing(entries)).warn("Connection refused", { namespace: null, clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: { count: 41, windowMs: 60_000 } });

		expect(entries).toEqual([
			{ event: "kafka.client_log", namespace: null, clientEvent: KAFKA_BROKER_FAILED_EVENT, message: "Connection refused", repeatCount: 41, repeatWindowMs: 60_000 },
		]);
	});
});

describe("observeKafkaConsumer", () => {
	it("logs a failed heartbeat as a warning and a lost group as an error, besides the broker failures every client reports", () => {
		const entries: ConsumerLogEntry[] = [];
		const consumer = new EventEmitter();
		observeKafkaConsumer(consumer, consumerLogSink(capturing(entries)));

		consumer.emit(KAFKA_HEARTBEAT_ERROR_EVENT, { error: new Error("REBALANCE_IN_PROGRESS") });
		consumer.emit(KAFKA_GROUP_LOST_EVENT, { error: new Error("UNKNOWN_MEMBER_ID") });
		consumer.emit(KAFKA_BROKER_FAILED_EVENT, { broker: { host: "kafka-1", port: 9092 } });

		expect(entries).toEqual([
			{ event: "kafka.client_log", namespace: "consumer", clientEvent: KAFKA_HEARTBEAT_ERROR_EVENT, message: "REBALANCE_IN_PROGRESS" },
			{ event: "kafka.client_log", namespace: "consumer", clientEvent: KAFKA_GROUP_LOST_EVENT, message: "UNKNOWN_MEMBER_ID" },
			{ event: "kafka.client_log", namespace: "consumer", clientEvent: KAFKA_BROKER_FAILED_EVENT, message: "Connection to broker kafka-1:9092 failed" },
		]);
	});
});

describe("createKafkaClient", () => {
	it("creates admin and consumer clients without contacting a broker, and flushes its log aggregation on demand", async () => {
		const entries: ConsumerLogEntry[] = [];
		const handle = createKafkaClient(
			{ brokers: ["127.0.0.1:1"], clientId: "analytics-test", security: KAFKA_PLAINTEXT_SECURITY, adminTimeoutMs: ADMIN_TIMEOUT_MS, topicRetentionDays: 7 },
			capturing(entries),
		);
		const admin = handle.admin();
		const consumer = handle.consumer("analytics-test-group");
		consumer.emit(KAFKA_BROKER_FAILED_EVENT, { broker: { host: "127.0.0.1", port: 1 }, connection: null });
		consumer.emit(KAFKA_BROKER_FAILED_EVENT, { broker: { host: "127.0.0.1", port: 1 }, connection: null });

		handle.flushLogs();
		await consumer.close();
		await admin.close();

		expect(entries.map((entry) => entry.repeatCount ?? null)).toEqual([null, 1]);
		expect(consumer.groupId).toBe("analytics-test-group");
	});
});
