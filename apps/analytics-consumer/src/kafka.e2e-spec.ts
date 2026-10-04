import { randomUUID } from "node:crypto";

import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { KafkaTopicDriftError, provisionKafkaTopics, type KafkaTopicSpec } from "@workspace/messaging/kafka";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadKafkaConnectionEnv, type ConsumerStartPosition } from "./env";
import { buildConsumerConfig, createKafkaClient } from "./kafka";
import { SILENT_LOGGER } from "./test-support/e2e-database";

/**
 * Real-broker proof (KAFKA_BROKERS) of explicit topic provisioning and of the
 * consumer's start position: a NEW group configured `earliest` consumes the
 * backlog published before it existed; `latest` skips it. Topics and groups
 * are unique per run and deleted afterwards.
 */

const KAFKA_TEST_TIMEOUT_MS = 90_000;
const ADMIN_TIMEOUT_MS = 30_000;
const BACKLOG_SIZE = 3;
const LATEST_OBSERVATION_MS = 5_000;
const POLL_INTERVAL_MS = 100;
const MS_PER_DAY = 86_400_000;

function spec(topic: string, partitions: number): KafkaTopicSpec {
	return { topic, partitions, replicationFactor: 1, retentionMs: MS_PER_DAY };
}

async function waitUntil(condition: () => boolean, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (!condition() && Date.now() < deadline) {
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, POLL_INTERVAL_MS);
		});
	}
	return condition();
}

describe("Kafka (integration)", () => {
	const runId = randomUUID();
	const createdTopics: string[] = [];
	let kafka: KafkaJS.Kafka;
	let admin: KafkaJS.Admin;

	beforeAll(async () => {
		kafka = createKafkaClient(loadKafkaConnectionEnv(), SILENT_LOGGER).kafka;
		admin = kafka.admin();
		await admin.connect();
	});

	afterAll(async () => {
		if (createdTopics.length > 0) {
			await admin.deleteTopics({ topics: createdTopics, timeout: ADMIN_TIMEOUT_MS });
		}
		await admin.disconnect();
	});

	it(
		"provisions missing topics with the configured shape, idempotently, and reports drift instead of accepting broker defaults",
		async () => {
			const topic = `e2e.provision.${runId}`;
			createdTopics.push(topic);

			await expect(provisionKafkaTopics(admin, [spec(topic, 2)], ADMIN_TIMEOUT_MS)).resolves.toEqual({ created: [topic], alreadyPresent: [] });
			await expect(provisionKafkaTopics(admin, [spec(topic, 2)], ADMIN_TIMEOUT_MS)).resolves.toEqual({ created: [], alreadyPresent: [topic] });

			const [metadata] = await admin.fetchTopicMetadata({ topics: [topic], timeout: ADMIN_TIMEOUT_MS });
			expect(metadata?.partitions).toHaveLength(2);

			await expect(provisionKafkaTopics(admin, [spec(topic, 4)], ADMIN_TIMEOUT_MS)).rejects.toBeInstanceOf(KafkaTopicDriftError);
		},
		KAFKA_TEST_TIMEOUT_MS,
	);

	async function consumeBacklog(startFrom: ConsumerStartPosition, observeMs: number): Promise<string[]> {
		const topic = `e2e.backlog.${startFrom}.${runId}`;
		createdTopics.push(topic);
		await provisionKafkaTopics(admin, [spec(topic, 1)], ADMIN_TIMEOUT_MS);

		const producer = kafka.producer({ kafkaJS: { allowAutoTopicCreation: false } });
		await producer.connect();
		await producer.send({ topic, messages: Array.from({ length: BACKLOG_SIZE }, (_: undefined, index: number): KafkaJS.Message => ({ value: `backlog-${String(index)}` })) });
		await producer.disconnect();

		const received: string[] = [];
		const consumer = kafka.consumer(buildConsumerConfig(`e2e-group-${startFrom}-${runId}`, startFrom));
		await consumer.connect();
		await consumer.subscribe({ topics: [topic] });
		await consumer.run({
			eachMessage: async ({ message }): Promise<void> => {
				received.push(message.value?.toString("utf8") ?? "");
				await Promise.resolve();
			},
		});
		try {
			await waitUntil((): boolean => received.length >= BACKLOG_SIZE, observeMs);
		} finally {
			await consumer.disconnect();
		}
		return received;
	}

	it(
		"a NEW group configured earliest consumes the backlog published before it existed",
		async () => {
			await expect(consumeBacklog("earliest", KAFKA_TEST_TIMEOUT_MS / 2)).resolves.toEqual(["backlog-0", "backlog-1", "backlog-2"]);
		},
		KAFKA_TEST_TIMEOUT_MS,
	);

	it(
		"a NEW group configured latest skips that backlog",
		async () => {
			await expect(consumeBacklog("latest", LATEST_OBSERVATION_MS)).resolves.toEqual([]);
		},
		KAFKA_TEST_TIMEOUT_MS,
	);
});
