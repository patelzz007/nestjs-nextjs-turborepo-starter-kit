import { randomUUID } from "node:crypto";

import type pg from "pg";

import type { AnalyticsEventRow, DeadLetterInput, InboxClaim, InboxStore, InboxTransaction } from "./inbox";
import { INBOX_RETENTION_OPERATION, type InboxRetentionStore, type LockedRun } from "./inbox-retention";

/**
 * Session tag recorded in `app.system_operation` for every ingest
 * transaction (claim, analytics write, dead-letter park) (ADR 012 / ADR 015): writes run as `app_runtime` with an explicit
 * bypass for the bypass-only infrastructure tables — never as the superuser.
 */
export const ANALYTICS_INGEST_OPERATION = "analytics.ingest";

/** Bound on what we keep of a poison message (TEXT column) — enough to diagnose and replay. */
export const DEAD_LETTER_RAW_VALUE_MAX_CHARS = 65_536;
export const DEAD_LETTER_ERROR_MAX_CHARS = 4_000;

class PgInboxTransaction implements InboxTransaction {
	public constructor(private readonly _client: pg.PoolClient) {}

	public async claim(claim: InboxClaim): Promise<boolean> {
		const result = await this._client.query(
			`INSERT INTO public.inbox_processed_events (consumer, event_id, topic, event_type)
			 VALUES ($1, $2::uuid, $3, $4)
			 ON CONFLICT (consumer, event_id) DO NOTHING`,
			[claim.consumer, claim.eventId, claim.topic, claim.eventType],
		);
		return result.rowCount === 1;
	}

	public async insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void> {
		// The analytics row id IS the stable event id: a second guard behind the inbox claim.
		await this._client.query(
			`INSERT INTO public.analytics_events (id, topic, event_type, correlation_id, partition_key, payload, occurred_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
			 ON CONFLICT (id) DO NOTHING`,
			[row.eventId, row.topic, row.eventType, row.correlationId, row.partitionKey, JSON.stringify(row.payload), row.occurredAt],
		);
	}
}

/** Postgres inbox — one transaction per Kafka message, scoped to `app_runtime` + explicit bypass. */
export class PgInboxStore implements InboxStore, InboxRetentionStore {
	public constructor(private readonly _pool: pg.Pool) {}

	public inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T> {
		return this.withSystemSession(ANALYTICS_INGEST_OPERATION, (client): Promise<T> => work(new PgInboxTransaction(client)));
	}

	public async park(deadLetter: DeadLetterInput): Promise<void> {
		await this.withSystemSession(ANALYTICS_INGEST_OPERATION, async (client): Promise<void> => {
			await client.query(
				`INSERT INTO public.inbox_dead_letters (id, consumer, topic, partition, "offset", event_id, reason, error, raw_value)
				 VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::"InboxDeadLetterReason", $8, $9)
				 ON CONFLICT (consumer, topic, partition, "offset") DO NOTHING`,
				[
					randomUUID(),
					deadLetter.consumer,
					deadLetter.topic,
					deadLetter.partition,
					deadLetter.offset,
					deadLetter.eventId,
					deadLetter.reason,
					deadLetter.error.slice(0, DEAD_LETTER_ERROR_MAX_CHARS),
					deadLetter.rawValue === null ? null : deadLetter.rawValue.slice(0, DEAD_LETTER_RAW_VALUE_MAX_CHARS),
				],
			);
		});
	}

	/**
	 * Session-level advisory lock keyed by `hashtextextended('analytics.inbox_retention', 0)`
	 * on a dedicated connection. `pg_try_advisory_lock` never waits: a second
	 * instance gets `{ acquired: false }` immediately. The lock dies with the
	 * session, so a crashed holder can never wedge retention; if the explicit
	 * unlock fails, the connection is destroyed instead of being pooled.
	 */
	public async withRetentionLock<T>(work: () => Promise<T>): Promise<LockedRun<T>> {
		const client = await this._pool.connect();
		let brokenConnection: Error | undefined;
		try {
			const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [INBOX_RETENTION_OPERATION]);
			if (lock.rows[0]?.locked !== true) {
				return { acquired: false };
			}
			try {
				return { acquired: true, result: await work() };
			} finally {
				try {
					await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [INBOX_RETENTION_OPERATION]);
				} catch (unlockError) {
					brokenConnection = unlockError instanceof Error ? unlockError : new Error(String(unlockError));
				}
			}
		} finally {
			client.release(brokenConnection);
		}
	}

	/**
	 * One bounded DELETE, oldest first via the `processed_at` index. `SKIP
	 * LOCKED` steps over any row another transaction holds instead of waiting.
	 */
	public deleteProcessedBefore(cutoffEpochMs: number, batchSize: number): Promise<number> {
		return this.withSystemSession(INBOX_RETENTION_OPERATION, async (client): Promise<number> => {
			const result = await client.query(
				`DELETE FROM public.inbox_processed_events
				 WHERE (consumer, event_id) IN (
				   SELECT consumer, event_id FROM public.inbox_processed_events
				   WHERE processed_at < $1
				   ORDER BY processed_at
				   LIMIT $2
				   FOR UPDATE SKIP LOCKED
				 )`,
				[cutoffEpochMs, batchSize],
			);
			return result.rowCount ?? 0;
		});
	}

	/**
	 * BEGIN → transaction-local `app_runtime` role + bypass session tag → work →
	 * COMMIT (ROLLBACK on any error). A connection whose ROLLBACK fails is
	 * destroyed rather than returned to the pool.
	 */
	private async withSystemSession<T>(operation: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
		const client = await this._pool.connect();
		let brokenConnection: Error | undefined;
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('role', 'app_runtime', true)");
			await client.query("SELECT set_config('app.rls_bypass', 'true', true)");
			await client.query("SELECT set_config('app.system_operation', $1, true)", [operation]);
			const result = await work(client);
			await client.query("COMMIT");
			return result;
		} catch (error) {
			try {
				await client.query("ROLLBACK");
			} catch (rollbackError) {
				brokenConnection = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
			}
			throw error;
		} finally {
			client.release(brokenConnection);
		}
	}
}
