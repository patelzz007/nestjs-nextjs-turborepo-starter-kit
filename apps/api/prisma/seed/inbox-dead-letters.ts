import { createHash } from "node:crypto";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

/**
 * Development-scenario sample of parked Kafka records (`inbox_dead_letters`),
 * so the operator runbook queries (docs/technical/messaging.md) have
 * something to show. Shaped exactly as apps/analytics-consumer parks them:
 * raw bytes + ORIGINAL size + SHA-256 + truncation flag, the attempts made,
 * and the `analytics-warehouse` consumer id its RLS policies are scoped to.
 */

/** ANALYTICS_CONSUMER_ID in apps/analytics-consumer/src/message-handler.ts. */
export const DEAD_LETTER_SEED_CONSUMER = "analytics-warehouse";

const SEED_TOPIC = "platform.rewards";
const MS_PER_DAY = 86_400_000;

export interface DeadLetterSeedRow {
	readonly id: string;
	readonly consumer: string;
	readonly topic: string;
	readonly partition: number;
	readonly offset: string;
	readonly eventId: string | null;
	readonly reason: "MALFORMED_JSON" | "RETRIES_EXHAUSTED";
	readonly error: string;
	readonly attempts: number;
	readonly rawValue: Uint8Array<ArrayBuffer>;
	readonly rawValueSizeBytes: number;
	readonly rawValueSha256: string;
	readonly rawValueTruncated: boolean;
	readonly receivedAt: bigint;
}

interface DeadLetterSeedSpec {
	readonly key: string;
	readonly offset: string;
	readonly eventId: string | null;
	readonly reason: DeadLetterSeedRow["reason"];
	readonly error: string;
	readonly attempts: number;
	readonly value: string;
	readonly daysAgo: number;
}

const RETRIED_EVENT_ID = deterministicUuid("dead-letter-seed-event", "retries-exhausted");

const SPECS: readonly DeadLetterSeedSpec[] = [
	{
		key: "malformed-json",
		offset: "9000000001",
		eventId: null,
		reason: "MALFORMED_JSON",
		error: "Unexpected token 'n', \"{not json\" is not valid JSON",
		attempts: 1,
		value: "{not json",
		daysAgo: 2,
	},
	{
		key: "retries-exhausted",
		offset: "9000000002",
		eventId: RETRIED_EVENT_ID,
		reason: "RETRIES_EXHAUSTED",
		error: "after 5 attempts: Connection terminated due to connection timeout",
		attempts: 5,
		value: JSON.stringify({
			eventId: RETRIED_EVENT_ID,
			type: "reward.platform",
			correlationId: "seed-dead-letter",
			occurredAt: 1_790_812_800_000,
			payload: { event: "reward.auto_published", actorUserId: null, organizationId: null, metadata: {} },
		}),
		daysAgo: 1,
	},
];

/** Pure, deterministic rows (except `receivedAt`, relative to `nowMs` so retention keeps them). */
export function buildDeadLetterSeedRows(nowMs: number): readonly DeadLetterSeedRow[] {
	return SPECS.map((spec: DeadLetterSeedSpec): DeadLetterSeedRow => {
		const bytes = Buffer.from(spec.value, "utf8");
		return {
			id: deterministicUuid("inbox-dead-letter", spec.key),
			consumer: DEAD_LETTER_SEED_CONSUMER,
			topic: SEED_TOPIC,
			partition: 0,
			offset: spec.offset,
			eventId: spec.eventId,
			reason: spec.reason,
			error: spec.error,
			attempts: spec.attempts,
			rawValue: new Uint8Array(bytes),
			rawValueSizeBytes: bytes.length,
			rawValueSha256: createHash("sha256").update(bytes).digest("hex"),
			rawValueTruncated: false,
			receivedAt: BigInt(nowMs - spec.daysAgo * MS_PER_DAY),
		};
	});
}

/** Idempotent upsert of the sample dead letters; returns how many the consumer id now has. */
export async function seedInboxDeadLetters(nowMs: number = Date.now()): Promise<number> {
	for (const row of buildDeadLetterSeedRows(nowMs)) {
		const data = {
			consumer: row.consumer,
			topic: row.topic,
			partition: row.partition,
			offset: row.offset,
			eventId: row.eventId,
			reason: row.reason,
			error: row.error,
			attempts: row.attempts,
			rawValue: row.rawValue,
			rawValueSizeBytes: row.rawValueSizeBytes,
			rawValueSha256: row.rawValueSha256,
			rawValueTruncated: row.rawValueTruncated,
			receivedAt: row.receivedAt,
		};
		// Upsert by the natural key (Kafka coordinates per consumer) — the same row a real park would hit.
		await prisma.inboxDeadLetter.upsert({
			where: { consumer_topic_partition_offset: { consumer: row.consumer, topic: row.topic, partition: row.partition, offset: row.offset } },
			create: { id: row.id, ...data },
			update: data,
		});
	}
	return prisma.inboxDeadLetter.count({ where: { consumer: DEAD_LETTER_SEED_CONSUMER } });
}
