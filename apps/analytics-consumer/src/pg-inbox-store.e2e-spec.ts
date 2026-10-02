import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConsumerEnv } from "./env";
import { handlePlatformMessage, type ConsumerLogger, type KafkaRecord, type MessageHandlerDeps } from "./message-handler";
import { PgInboxStore } from "./pg-inbox-store";

/**
 * Real-Postgres proof of the consumer inbox (ADR 015): the unique
 * (consumer, event_id) key + ON CONFLICT DO NOTHING in the same transaction as
 * the analytics write makes redelivery idempotent; rollback un-claims.
 * Requires apps/api/.env with migrations + `pnpm db:apply-security` applied.
 */

class DomainFailure extends Error {}

const SILENT_LOGGER: ConsumerLogger = {
	info: (): void => undefined,
	warn: (): void => undefined,
	error: (): void => undefined,
};

describe("PgInboxStore (integration)", () => {
	const consumerId = `e2e-${randomUUID()}`;
	const eventIds: string[] = [];
	let pool: pg.Pool;
	let deps: MessageHandlerDeps;

	function rewardRecord(eventId: string, offset: string): KafkaRecord {
		const value = JSON.stringify({
			eventId,
			type: "reward.platform",
			correlationId: "inbox-e2e",
			occurredAt: 1_790_812_800_000,
			payload: { event: "reward.auto_published", actorUserId: null, organizationId: null, metadata: {} },
		});
		return { topic: "platform.rewards", partition: 0, offset, value: Buffer.from(value, "utf8") };
	}

	async function count(sql: string, values: readonly string[]): Promise<number> {
		const result = await pool.query<{ count: number }>(sql, [...values]);
		return result.rows[0]?.count ?? 0;
	}

	beforeAll(() => {
		pool = new pg.Pool({ connectionString: loadConsumerEnv().DATABASE_URL });
		deps = { store: new PgInboxStore(pool), logger: SILENT_LOGGER, consumerId, nowMs: (): number => Date.now() };
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.inbox_processed_events WHERE consumer = $1", [consumerId]);
		await pool.query("DELETE FROM public.inbox_dead_letters WHERE consumer = $1", [consumerId]);
		if (eventIds.length > 0) {
			await pool.query("DELETE FROM public.analytics_events WHERE id = ANY($1::text[])", [eventIds]);
		}
		await pool.end();
	});

	it("applies a redelivered / republished event exactly once", async () => {
		const eventId = randomUUID();
		eventIds.push(eventId);

		const first = await handlePlatformMessage(rewardRecord(eventId, "1"), deps);
		const redelivery = await handlePlatformMessage(rewardRecord(eventId, "1"), deps);
		const republish = await handlePlatformMessage(rewardRecord(eventId, "2"), deps);

		expect([first.kind, redelivery.kind, republish.kind]).toEqual(["processed", "duplicate", "duplicate"]);
		expect(await count("SELECT COUNT(*)::int AS count FROM public.analytics_events WHERE id = $1", [eventId])).toBe(1);
		expect(await count("SELECT COUNT(*)::int AS count FROM public.inbox_processed_events WHERE consumer = $1 AND event_id = $2::uuid", [consumerId, eventId])).toBe(1);
	});

	it("un-claims the event when the transaction rolls back", async () => {
		const eventId = randomUUID();

		await expect(
			deps.store.inTransaction(async (tx): Promise<void> => {
				await tx.claim({ consumer: consumerId, eventId, topic: "platform.rewards", eventType: "reward.platform" });
				throw new DomainFailure("side effect failed after claiming");
			}),
		).rejects.toBeInstanceOf(DomainFailure);

		expect(await count("SELECT COUNT(*)::int AS count FROM public.inbox_processed_events WHERE consumer = $1 AND event_id = $2::uuid", [consumerId, eventId])).toBe(0);
	});

	it("parks a poison record once, however often Kafka redelivers it", async () => {
		const poison: KafkaRecord = { topic: "platform.rewards", partition: 0, offset: "77", value: Buffer.from("{not json", "utf8") };

		await handlePlatformMessage(poison, deps);
		await handlePlatformMessage(poison, deps);

		const parked = await pool.query<{ reason: string; rawValue: string }>(
			'SELECT reason::text AS reason, raw_value AS "rawValue" FROM public.inbox_dead_letters WHERE consumer = $1',
			[consumerId],
		);
		expect(parked.rows).toEqual([{ reason: "MALFORMED_JSON", rawValue: "{not json" }]);
	});
});
