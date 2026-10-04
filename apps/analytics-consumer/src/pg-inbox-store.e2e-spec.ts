import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ANALYTICS_CONSUMER_ID, handlePlatformMessage, type KafkaRecord, type MessageHandlerDeps } from "./message-handler";
import { PgInboxStore } from "./pg-inbox-store";
import { closeE2eDatabase, openE2eDatabase, SILENT_LOGGER, type E2eDatabase } from "./test-support/e2e-database";

/**
 * Real-Postgres proof of the consumer inbox (ADR 015), running as the
 * least-privilege `analytics_consumer` login: the unique (consumer, event_id)
 * key + ON CONFLICT DO NOTHING in the same transaction as the analytics write
 * makes redelivery idempotent; rollback un-claims; poison records are parked
 * binary-safe. Every row uses a per-run topic name so cleanup is exact.
 */

class DomainFailure extends Error {}

const MAX_PAYLOAD_BYTES = 1_024;
const PgErrorSchema = z.object({ code: z.string() });

const ParkedRowSchema = z.object({
	reason: z.string(),
	attempts: z.number(),
	raw_value: z.instanceof(Buffer).nullable(),
	raw_value_size_bytes: z.number().nullable(),
	raw_value_sha256: z.string().nullable(),
	raw_value_truncated: z.boolean(),
});

async function sqlStateOf(work: Promise<object>): Promise<string | null> {
	try {
		await work;
		return null;
	} catch (error) {
		const parsed = PgErrorSchema.safeParse(error);
		return parsed.success ? parsed.data.code : "non-pg-error";
	}
}

describe("PgInboxStore as the analytics_consumer role (integration)", () => {
	const topic = `e2e.inbox.${randomUUID()}`;
	const eventIds: string[] = [];
	let database: E2eDatabase;
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
		const result = await database.admin.query<{ count: number }>(sql, [...values]);
		return result.rows[0]?.count ?? 0;
	}

	async function parkedRows(): Promise<z.output<typeof ParkedRowSchema>[]> {
		const result = await database.admin.query(
			'SELECT reason::text AS reason, attempts, raw_value, raw_value_size_bytes, raw_value_sha256, raw_value_truncated FROM public.inbox_dead_letters WHERE topic = $1 ORDER BY partition, "offset"',
			[topic],
		);
		return z.array(ParkedRowSchema).parse(result.rows);
	}

	beforeAll(async () => {
		database = await openE2eDatabase();
		deps = {
			store: new PgInboxStore(database.consumer),
			logger: SILENT_LOGGER,
			consumerId: ANALYTICS_CONSUMER_ID,
			nowMs: (): number => Date.now(),
			retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
			deadLetterMaxPayloadBytes: MAX_PAYLOAD_BYTES,
			sleep: (): Promise<void> => Promise.resolve(),
			random: (): number => 0.5,
			signal: new AbortController().signal,
		};
	});

	afterAll(async () => {
		await database.admin.query("DELETE FROM public.inbox_dead_letters WHERE topic = $1", [topic]);
		if (eventIds.length > 0) {
			await database.admin.query("DELETE FROM public.inbox_processed_events WHERE consumer = $1 AND event_id = ANY($2::uuid[])", [ANALYTICS_CONSUMER_ID, eventIds]);
			await database.admin.query("DELETE FROM public.analytics_events WHERE id = ANY($1::text[])", [eventIds]);
		}
		await closeE2eDatabase(database);
	});

	it("applies a redelivered / republished event exactly once", async () => {
		const eventId = randomUUID();
		eventIds.push(eventId);

		const first = await handlePlatformMessage(rewardRecord(eventId, "1"), deps);
		const redelivery = await handlePlatformMessage(rewardRecord(eventId, "1"), deps);
		const republish = await handlePlatformMessage(rewardRecord(eventId, "2"), deps);

		expect([first.kind, redelivery.kind, republish.kind]).toEqual(["processed", "duplicate", "duplicate"]);
		expect(await count("SELECT COUNT(*)::int AS count FROM public.analytics_events WHERE id = $1", [eventId])).toBe(1);
		expect(await count("SELECT COUNT(*)::int AS count FROM public.inbox_processed_events WHERE consumer = $1 AND event_id = $2::uuid", [ANALYTICS_CONSUMER_ID, eventId])).toBe(
			1,
		);
	});

	it("un-claims the event when the transaction rolls back", async () => {
		const eventId = randomUUID();

		await expect(
			deps.store.inTransaction(async (tx): Promise<void> => {
				await tx.claim({ consumer: ANALYTICS_CONSUMER_ID, eventId, topic, eventType: "reward.platform" });
				throw new DomainFailure("side effect failed after claiming");
			}),
		).rejects.toBeInstanceOf(DomainFailure);

		expect(await count("SELECT COUNT(*)::int AS count FROM public.inbox_processed_events WHERE consumer = $1 AND event_id = $2::uuid", [ANALYTICS_CONSUMER_ID, eventId])).toBe(
			0,
		);
	});

	it("parks a poison record once — bytes intact (incl. NUL / invalid UTF-8) with size and SHA-256", async () => {
		const value = Buffer.from([0x7b, 0x00, 0xff, 0xfe]);
		const poison: KafkaRecord = { topic, partition: 0, offset: "77", value };

		await handlePlatformMessage(poison, deps);
		await handlePlatformMessage(poison, deps);

		expect(await parkedRows()).toEqual([
			{
				reason: "MALFORMED_JSON",
				attempts: 1,
				raw_value: value,
				raw_value_size_bytes: value.length,
				raw_value_sha256: createHash("sha256").update(value).digest("hex"),
				raw_value_truncated: false,
			},
		]);
	});

	it("stores an oversized poison record truncated, flagged, with the original size", async () => {
		const value = Buffer.alloc(MAX_PAYLOAD_BYTES * 2, 0x61);

		await handlePlatformMessage({ topic, partition: 1, offset: "1", value }, deps);

		const truncated = (await parkedRows()).find((row) => row.raw_value_truncated);
		expect(truncated).toMatchObject({ raw_value_size_bytes: MAX_PAYLOAD_BYTES * 2, raw_value_sha256: createHash("sha256").update(value).digest("hex") });
		expect(truncated?.raw_value?.length).toBe(MAX_PAYLOAD_BYTES);
	});

	describe("least privilege", () => {
		it("cannot read any other table — even after setting the RLS bypass flags itself", async () => {
			const client = await database.consumer.connect();
			try {
				await client.query("SELECT set_config('app.rls_bypass', 'true', false), set_config('app.system_operation', 'analytics.ingest', false)");
				expect(await sqlStateOf(client.query("SELECT 1 FROM public.users LIMIT 1"))).toBe("42501");
				expect(await sqlStateOf(client.query("SELECT 1 FROM public.outbox_events LIMIT 1"))).toBe("42501");
			} finally {
				client.release(true);
			}
		});

		it("cannot switch to app_runtime, read analytics rows, or write another consumer's ledger", async () => {
			expect(await sqlStateOf(database.consumer.query("SET ROLE app_runtime"))).toBe("42501");
			expect(await sqlStateOf(database.consumer.query("SELECT payload FROM public.analytics_events LIMIT 1"))).toBe("42501");
			expect(
				await sqlStateOf(
					database.consumer.query("INSERT INTO public.inbox_processed_events (consumer, event_id, topic, event_type) VALUES ('another-consumer', $1::uuid, $2, 'x')", [
						randomUUID(),
						topic,
					]),
				),
			).toBe("42501");
		});

		it("is not a superuser and cannot bypass RLS", async () => {
			const role = await database.consumer.query<{ rolsuper: boolean; rolbypassrls: boolean }>("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
			expect(role.rows).toEqual([{ rolsuper: false, rolbypassrls: false }]);
		});
	});
});
