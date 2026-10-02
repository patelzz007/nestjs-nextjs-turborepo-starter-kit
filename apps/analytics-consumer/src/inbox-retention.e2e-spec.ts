import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_INBOX_RETENTION_DAYS, loadConsumerEnv } from "./env";
import { INBOX_RETENTION_OPERATION, runInboxRetention, type InboxRetentionDeps } from "./inbox-retention";
import type { ConsumerLogger } from "./message-handler";
import { PgInboxStore } from "./pg-inbox-store";

/**
 * Real-Postgres proof of inbox retention: claims older than the window are
 * deleted as `app_runtime` + bypass (the table is bypass-only), newer ones and
 * every dead letter are kept, and a second instance is locked out by the
 * advisory lock. Requires apps/api/.env with migrations + `pnpm db:apply-security`.
 */

const MS_PER_DAY = 86_400_000;

const SILENT_LOGGER: ConsumerLogger = {
	info: (): void => undefined,
	warn: (): void => undefined,
	error: (): void => undefined,
};

describe("Inbox retention (integration)", () => {
	const consumerId = `retention-e2e-${randomUUID()}`;
	let pool: pg.Pool;
	let deps: InboxRetentionDeps;

	async function insertClaim(ageDays: number): Promise<string> {
		const eventId = randomUUID();
		await pool.query(
			"INSERT INTO public.inbox_processed_events (consumer, event_id, topic, event_type, processed_at) VALUES ($1, $2::uuid, 'platform.rewards', 'reward.platform', $3)",
			[consumerId, eventId, Date.now() - ageDays * MS_PER_DAY],
		);
		return eventId;
	}

	async function remainingClaims(): Promise<string[]> {
		const result = await pool.query<{ eventId: string }>('SELECT event_id::text AS "eventId" FROM public.inbox_processed_events WHERE consumer = $1 ORDER BY event_id', [
			consumerId,
		]);
		return result.rows.map((row): string => row.eventId);
	}

	beforeAll(() => {
		pool = new pg.Pool({ connectionString: loadConsumerEnv().DATABASE_URL });
		deps = { store: new PgInboxStore(pool), logger: SILENT_LOGGER, nowMs: (): number => Date.now(), retentionDays: DEFAULT_INBOX_RETENTION_DAYS };
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.inbox_processed_events WHERE consumer = $1", [consumerId]);
		await pool.query("DELETE FROM public.inbox_dead_letters WHERE consumer = $1", [consumerId]);
		await pool.end();
	});

	it("deletes claims older than the retention window, keeps newer ones and never touches dead letters", async () => {
		await insertClaim(DEFAULT_INBOX_RETENTION_DAYS + 1);
		await insertClaim(DEFAULT_INBOX_RETENTION_DAYS * 3);
		const kept = [await insertClaim(0), await insertClaim(DEFAULT_INBOX_RETENTION_DAYS - 1)].sort();
		await pool.query(
			`INSERT INTO public.inbox_dead_letters (id, consumer, topic, partition, "offset", reason, error, received_at)
			 VALUES ($1, $2, 'platform.rewards', 0, '1', 'MALFORMED_JSON', 'e2e', $3)`,
			[randomUUID(), consumerId, Date.now() - DEFAULT_INBOX_RETENTION_DAYS * 10 * MS_PER_DAY],
		);

		const outcome = await runInboxRetention(deps);

		expect(outcome).toMatchObject({ kind: "completed", stoppedBy: "drained" });
		expect(await remainingClaims()).toEqual(kept);
		const deadLetters = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM public.inbox_dead_letters WHERE consumer = $1", [consumerId]);
		expect(deadLetters.rows[0]?.count).toBe(1);
	});

	it("skips while another instance holds the advisory lock, then runs once it is released", async () => {
		const expired = await insertClaim(DEFAULT_INBOX_RETENTION_DAYS + 2);
		const otherInstance = await pool.connect();
		try {
			await otherInstance.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [INBOX_RETENTION_OPERATION]);

			await expect(runInboxRetention(deps)).resolves.toEqual({ kind: "skipped_locked" });
			expect(await remainingClaims()).toContain(expired);

			await otherInstance.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [INBOX_RETENTION_OPERATION]);
		} finally {
			otherInstance.release();
		}

		await expect(runInboxRetention(deps)).resolves.toMatchObject({ kind: "completed" });
		expect(await remainingClaims()).not.toContain(expired);
	});
});
