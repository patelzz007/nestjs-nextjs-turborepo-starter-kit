import { randomUUID } from "node:crypto";

import { Producer, type Admin, type MessagesStream } from "@platformatic/kafka";
import { KafkaTopicDriftError, buildKafkaClientOptions, provisionKafkaTopics, type KafkaTopicSpec } from "@workspace/messaging/kafka";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadKafkaConnectionEnv, type ConsumerStartPosition, type KafkaConnectionSettings } from "../env";
import { buildConsumeOptions, createKafkaClient, type KafkaClientHandle } from "../kafka";
import { SILENT_LOGGER } from "../../testing/e2e-database";

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
const MS_PER_DAY = 86_400_000;

function spec(topic: string, partitions: number): KafkaTopicSpec {
	return { topic, partitions, replicationFactor: 1, retentionMs: MS_PER_DAY };
}

/** Reads values from `stream` until `count` arrived or `observeMs` passed, then closes the stream. */
async function collectValues(stream: MessagesStream<Buffer, Buffer, Buffer, Buffer>, count: number, observeMs: number): Promise<string[]> {
	const received: string[] = [];
	const stop = setTimeout((): void => {
		void stream.close();
	}, observeMs);
	try {
		for await (const message of stream) {
			received.push(message.value.toString("utf8"));
			await message.commit();
			if (received.length >= count) {
				break;
			}
		}
	} finally {
		clearTimeout(stop);
		await stream.close();
	}
	return received;
}

describe("Kafka (integration)", () => {
	const runId = randomUUID();
	const createdTopics: string[] = [];
	let settings: KafkaConnectionSettings;
	let kafka: KafkaClientHandle;
	let admin: Admin;

	beforeAll(() => {
		settings = loadKafkaConnectionEnv();
		kafka = createKafkaClient(settings, SILENT_LOGGER);
		admin = kafka.admin();
	});

	afterAll(async () => {
		if (createdTopics.length > 0) {
			await admin.deleteTopics({ topics: createdTopics });
		}
		await admin.close();
		kafka.flushLogs();
	});

	it(
		"provisions missing topics with the configured shape, idempotently, and reports drift instead of accepting broker defaults",
		async () => {
			const topic = `e2e.provision.${runId}`;
			createdTopics.push(topic);

			await expect(provisionKafkaTopics(admin, [spec(topic, 2)], ADMIN_TIMEOUT_MS)).resolves.toEqual({ created: [topic], alreadyPresent: [] });
			await expect(provisionKafkaTopics(admin, [spec(topic, 2)], ADMIN_TIMEOUT_MS)).resolves.toEqual({ created: [], alreadyPresent: [topic] });

			const metadata = await admin.metadata({ topics: [topic], forceUpdate: true });
			expect(metadata.topics.get(topic)?.partitions).toHaveLength(2);

			await expect(provisionKafkaTopics(admin, [spec(topic, 4)], ADMIN_TIMEOUT_MS)).rejects.toBeInstanceOf(KafkaTopicDriftError);
		},
		KAFKA_TEST_TIMEOUT_MS,
	);

	async function consumeBacklog(startFrom: ConsumerStartPosition, observeMs: number): Promise<string[]> {
		const topic = `e2e.backlog.${startFrom}.${runId}`;
		createdTopics.push(topic);
		await provisionKafkaTopics(admin, [spec(topic, 1)], ADMIN_TIMEOUT_MS);

		const producer = new Producer({ ...buildKafkaClientOptions(settings), autocreateTopics: false });
		try {
			await producer.send({ messages: Array.from({ length: BACKLOG_SIZE }, (_: undefined, index: number) => ({ topic, value: Buffer.from(`backlog-${String(index)}`) })) });
		} finally {
			await producer.close();
		}

		const consumer = kafka.consumer(`e2e-group-${startFrom}-${runId}`);
		try {
			return await collectValues(await consumer.consume(buildConsumeOptions([topic], startFrom)), BACKLOG_SIZE, observeMs);
		} finally {
			await consumer.close();
		}
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
