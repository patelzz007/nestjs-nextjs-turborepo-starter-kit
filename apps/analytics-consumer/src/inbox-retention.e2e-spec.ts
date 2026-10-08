import { randomUUID } from "node:crypto";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RETENTION_LOCK_NAMES, runLedgerRetention, type RetentionDeps } from "@workspace/messaging/inbox";
import { ANALYTICS_CONSUMER_ID, PgInboxStore } from "@workspace/messaging/inbox";
import { closeE2eDatabase, openE2eDatabase, SILENT_LOGGER, type E2eDatabase } from "./test-support/e2e-database";

/**
 * Real-Postgres proof of retention as the least-privilege role: inbox claims
 * and parked messages older than their windows are deleted, newer ones kept;
 * a second instance holding a ledger's transaction-level advisory lock makes
 * the run skip; and no advisory lock outlives a purge transaction (safe
 * behind PgBouncer transaction pooling). Fixture rows carry a per-run topic.
 */

const MS_PER_DAY = 86_400_000;
const INBOX_RETENTION_DAYS = 14;
const DEAD_LETTER_RETENTION_DAYS = 30;

describe("Retention (integration)", () => {
	const topic = `e2e.retention.${randomUUID()}`;
	let database: E2eDatabase;
	let deps: RetentionDeps;
	let offset = 0;

	async function insertClaim(ageDays: number): Promise<string> {
		const eventId = randomUUID();
		await database.admin.query(
			"INSERT INTO public.inbox_processed_events (consumer, event_id, topic, event_type, processed_at) VALUES ($1, $2::uuid, $3, 'reward.platform', $4)",
			[ANALYTICS_CONSUMER_ID, eventId, topic, Date.now() - ageDays * MS_PER_DAY],
		);
		return eventId;
	}

	async function insertDeadLetter(ageDays: number): Promise<string> {
		const id = randomUUID();
		offset += 1;
		await database.admin.query(
			`INSERT INTO public.inbox_dead_letters (id, consumer, topic, partition, "offset", reason, error, received_at)
			 VALUES ($1, $2, $3, 0, $4, 'MALFORMED_JSON', 'e2e', $5)`,
			[id, ANALYTICS_CONSUMER_ID, topic, String(offset), Date.now() - ageDays * MS_PER_DAY],
		);
		return id;
	}

	async function remaining(table: "inbox_processed_events" | "inbox_dead_letters"): Promise<string[]> {
		const column = table === "inbox_processed_events" ? "event_id::text" : "id";
		const result = await database.admin.query<{ id: string }>(`SELECT ${column} AS id FROM public.${table} WHERE topic = $1 ORDER BY 1`, [topic]);
		return result.rows.map((row): string => row.id);
	}

	beforeAll(async () => {
		database = await openE2eDatabase();
		deps = {
			store: new PgInboxStore(database.consumer),
			logger: SILENT_LOGGER,
			nowMs: (): number => Date.now(),
			consumerId: ANALYTICS_CONSUMER_ID,
			inboxRetentionDays: INBOX_RETENTION_DAYS,
			deadLetterRetentionDays: DEAD_LETTER_RETENTION_DAYS,
		};
	});

	afterAll(async () => {
		await database.admin.query("DELETE FROM public.inbox_processed_events WHERE topic = $1", [topic]);
		await database.admin.query("DELETE FROM public.inbox_dead_letters WHERE topic = $1", [topic]);
		await closeE2eDatabase(database);
	});

	it("deletes inbox claims older than the window and keeps newer ones", async () => {
		const expired = [await insertClaim(INBOX_RETENTION_DAYS + 1), await insertClaim(INBOX_RETENTION_DAYS * 3)];
		const kept = [await insertClaim(0), await insertClaim(INBOX_RETENTION_DAYS - 1)].sort();

		const outcome = await runLedgerRetention("inbox_claims", deps);

		expect(outcome).toMatchObject({ kind: "completed", stoppedBy: "drained" });
		const left = await remaining("inbox_processed_events");
		expect(left).toEqual(expect.arrayContaining(kept));
		expect(left).not.toEqual(expect.arrayContaining(expired));
	});

	it("deletes parked messages older than the dead-letter window and keeps newer ones", async () => {
		const expired = await insertDeadLetter(DEAD_LETTER_RETENTION_DAYS + 1);
		const kept = await insertDeadLetter(DEAD_LETTER_RETENTION_DAYS - 1);

		await expect(runLedgerRetention("dead_letters", deps)).resolves.toMatchObject({ kind: "completed" });

		const left = await remaining("inbox_dead_letters");
		expect(left).toContain(kept);
		expect(left).not.toContain(expired);
	});

	it("skips while another instance holds the ledger's transaction lock, then runs once it commits", async () => {
		const expired = await insertClaim(INBOX_RETENTION_DAYS + 2);
		const otherInstance = await database.admin.connect();
		try {
			await otherInstance.query("BEGIN");
			await otherInstance.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [RETENTION_LOCK_NAMES.inbox_claims]);

			await expect(runLedgerRetention("inbox_claims", deps)).resolves.toEqual({ kind: "skipped_locked", ledger: "inbox_claims" });
			expect(await remaining("inbox_processed_events")).toContain(expired);

			await otherInstance.query("COMMIT");
		} finally {
			otherInstance.release();
		}

		await expect(runLedgerRetention("inbox_claims", deps)).resolves.toMatchObject({ kind: "completed" });
		expect(await remaining("inbox_processed_events")).not.toContain(expired);
	});

	it("leaves no advisory lock behind once a purge transaction ends", async () => {
		await runLedgerRetention("dead_letters", deps);

		const locks = await database.admin.query<{ count: number }>(
			"SELECT COUNT(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND objid = (hashtextextended($1, 0) & 4294967295)::bigint::oid",
			[RETENTION_LOCK_NAMES.dead_letters],
		);
		expect(locks.rows[LIST_SLOT_INDEX.first]?.count).toBe(0);
	});
});
