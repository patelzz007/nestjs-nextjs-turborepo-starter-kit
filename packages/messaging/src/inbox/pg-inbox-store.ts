import { LIST_SLOT_INDEX, newRowId } from "@workspace/shared";

import pg from "pg";

import type { DbPoolSettings } from "./inbox-settings";
import type { AnalyticsEventRow, DeadLetterInput, InboxClaim, InboxStore, InboxTransaction } from "./inbox";
import { RETENTION_LOCK_NAMES, type LockedBatch, type RetentionLedger, type RetentionStore } from "./inbox-retention";

/** `application_name` on every connection — shows in `pg_stat_activity` and the Postgres logs. */
export const CONSUMER_APPLICATION_NAME = "analytics-consumer";

/**
 * Who the consumer's writes are recorded as. The consumer has no RLS session (no user, API key or system
 * operation), so it names itself through `app.actor`: the database's row-audit trigger stamps `createdBy` /
 * `updatedBy` / `deletedBy` from it (apps/api/prisma/rls/row-audit.ts).
 */
export const CONSUMER_ACTOR = "system:analytics-consumer";

/**
 * A value inside libpq's `options` startup string: whitespace separates `-c` switches there, so a
 * backslash and each whitespace character are escaped with a backslash (libpq's own escaping rule).
 */
export function escapeLibpqOptionValue(value: string): string {
	return value.replace(/[\\\s]/g, (character) => `\\${character}`);
}

/**
 * The consumer's Postgres pool: bounded size, bounded waits, and a
 * server-side `statement_timeout`, so a stuck query or an exhausted server
 * surfaces as an error (retried, then parked) instead of a hang.
 */
export function createConsumerPool(connectionString: string, settings: DbPoolSettings): pg.Pool {
	return new pg.Pool({
		connectionString,
		max: settings.max,
		connectionTimeoutMillis: settings.connectionTimeoutMs,
		idleTimeoutMillis: settings.idleTimeoutMs,
		statement_timeout: settings.statementTimeoutMs,
		application_name: CONSUMER_APPLICATION_NAME,
		options: `-c app.actor=${escapeLibpqOptionValue(CONSUMER_ACTOR)}`,
	});
}

class PgInboxTransaction implements InboxTransaction {
	public constructor(private readonly _client: pg.PoolClient) {}

	public async claim(claim: InboxClaim): Promise<boolean> {
		const result = await this._client.query(
			`INSERT INTO public."InboxProcessedEvent" (consumer, "eventId", topic, "eventType")
			 VALUES ($1, $2::uuid, $3, $4)
			 ON CONFLICT (consumer, "eventId") DO NOTHING`,
			[claim.consumer, claim.eventId, claim.topic, claim.eventType],
		);
		return result.rowCount === 1;
	}

	public async insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void> {
		// The analytics row id IS the stable event id: a second guard behind the inbox claim.
		await this._client.query(
			`INSERT INTO public."AnalyticsEvent" (id, topic, "eventType", "correlationId", "partitionKey", payload, "occurredAt")
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
			 ON CONFLICT (id) DO NOTHING`,
			[row.eventId, row.topic, row.eventType, row.correlationId, row.partitionKey, JSON.stringify(row.payload), row.occurredAt],
		);
	}
}

/** One bounded, oldest-first DELETE per ledger, scoped to one consumer's rows. */
const PURGE_SQL: Readonly<Record<RetentionLedger, string>> = {
	inbox_claims: `DELETE FROM public."InboxProcessedEvent"
		 WHERE (consumer, "eventId") IN (
		   SELECT consumer, "eventId" FROM public."InboxProcessedEvent"
		   WHERE consumer = $1 AND "processedAt" < $2
		   ORDER BY "processedAt"
		   LIMIT $3
		 )`,
	dead_letters: `DELETE FROM public."InboxDeadLetter"
		 WHERE id IN (
		   SELECT id FROM public."InboxDeadLetter"
		   WHERE consumer = $1 AND "receivedAt" < $2
		   ORDER BY "receivedAt"
		   LIMIT $3
		 )`,
};

/**
 * Postgres inbox. Connects as the least-privilege `analytics_consumer` login
 * (prisma/rls/90-analytics-consumer.sql): INSERT/SELECT/DELETE on its three
 * tables only, and RLS policies that apply to that role alone — it never
 * switches role and never sets `app.rls_bypass`.
 */
export class PgInboxStore implements InboxStore, RetentionStore {
	public constructor(private readonly _pool: pg.Pool) {}

	public inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T> {
		return this.withTransaction((client): Promise<T> => work(new PgInboxTransaction(client)));
	}

	public async park(deadLetter: DeadLetterInput): Promise<void> {
		const payload = deadLetter.payload;
		await this._pool.query(
			`INSERT INTO public."InboxDeadLetter"
			   (id, consumer, topic, partition, "offset", "eventId", reason, error, attempts,
			    "rawValue", "rawValueSizeBytes", "rawValueSha256", "rawValueTruncated")
			 VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::"InboxDeadLetterReason", $8, $9, $10, $11, $12, $13)
			 ON CONFLICT (consumer, topic, partition, "offset") DO NOTHING`,
			[
				newRowId(),
				deadLetter.consumer,
				deadLetter.topic,
				deadLetter.partition,
				deadLetter.offset,
				deadLetter.eventId,
				deadLetter.reason,
				deadLetter.error,
				deadLetter.attempts,
				payload?.bytes ?? null,
				payload?.sizeBytes ?? null,
				payload?.sha256 ?? null,
				payload?.truncated ?? false,
			],
		);
	}

	/**
	 * `pg_try_advisory_xact_lock` never waits: a second instance gets
	 * `{ acquired: false }` immediately. Being transaction-scoped, the lock is
	 * released by COMMIT/ROLLBACK on the same server connection — correct
	 * behind PgBouncer in transaction mode, and a crashed holder can never
	 * leave it held.
	 */
	public purgeBatch(ledger: RetentionLedger, consumer: string, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch> {
		return this.withTransaction(async (client): Promise<LockedBatch> => {
			const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked", [RETENTION_LOCK_NAMES[ledger]]);
			if (lock.rows[LIST_SLOT_INDEX.first]?.locked !== true) {
				return { acquired: false };
			}
			const result = await client.query(PURGE_SQL[ledger], [consumer, cutoffEpochMs, batchSize]);
			return { acquired: true, deleted: result.rowCount ?? 0 };
		});
	}

	/** BEGIN → work → COMMIT (ROLLBACK on any error). A connection whose ROLLBACK fails is destroyed rather than pooled. */
	private async withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
		const client = await this._pool.connect();
		let brokenConnection: Error | undefined;
		try {
			await client.query("BEGIN");
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
