import { CaughtValueSchema } from "@workspace/shared";
import { createHash } from "node:crypto";

import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { DatabaseError, Pool, type PoolClient } from "pg";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { IdempotencyRecordKey } from "./idempotency-record.repository";
import type { IdempotencyKeyLock, IdempotencyKeyLockOutcome, IdempotencyKeyLocks } from "./idempotency-key-locks";
import { IDEMPOTENCY_DUPLICATE_WAIT_MS, IDEMPOTENCY_LOCK_APPLICATION_NAME, IDEMPOTENCY_LOCK_POOL_MAX } from "./idempotency.constants";
import { caughtErrorLogFields } from "../../application/errors/caught-error-log";

/** SQLSTATE `lock_not_available`: the lock wait hit `lock_timeout`. */
const LOCK_NOT_AVAILABLE = "55P03";

/** The advisory-lock key is two int4 halves of a SHA-256 of the (scope, key) pair. */
const LOCK_KEY_HIGH_OFFSET = 0;
const LOCK_KEY_LOW_OFFSET = 4;

/** Separates scope and key in the hashed lock name (neither can contain a NUL). */
const LOCK_NAME_SEPARATOR = "\u0000";

/** The two int4 halves `pg_advisory_lock(int4, int4)` takes for one (scope, key). */
function advisoryLockKey(key: IdempotencyRecordKey): [number, number] {
	const digest: Buffer = createHash("sha256").update(`${key.scope}${LOCK_NAME_SEPARATOR}${key.idempotencyKey}`).digest();
	return [digest.readInt32BE(LOCK_KEY_HIGH_OFFSET), digest.readInt32BE(LOCK_KEY_LOW_OFFSET)];
}

/**
 * {@link IdempotencyKeyLocks} on Postgres session-level advisory locks (ADR 061).
 *
 * A dedicated pool, because a held lock pins its connection for the length of
 * the handler: the request pool must never be starved by waiting duplicates.
 * The wait is `pg_advisory_lock` under `lock_timeout` — Postgres wakes the
 * waiter the moment the holder unlocks (or its session ends, e.g. the process
 * crashed), so a duplicate issues exactly one lock statement however long it waits.
 */
@Injectable()
export class PostgresIdempotencyKeyLocks implements IdempotencyKeyLocks, OnModuleDestroy {
	private readonly logger: Logger = new Logger(PostgresIdempotencyKeyLocks.name);
	private readonly pool: Pool;

	public constructor(config: TypedConfigService) {
		this.pool = new Pool({
			connectionString: config.database.url,
			max: IDEMPOTENCY_LOCK_POOL_MAX,
			connectionTimeoutMillis: IDEMPOTENCY_DUPLICATE_WAIT_MS,
			idleTimeoutMillis: config.database.idleTimeoutMs,
			allowExitOnIdle: config.database.allowExitOnIdle,
			application_name: IDEMPOTENCY_LOCK_APPLICATION_NAME,
		});
	}

	public async acquire(key: IdempotencyRecordKey, waitMs: number): Promise<IdempotencyKeyLockOutcome> {
		const [high, low] = advisoryLockKey(key);
		const client: PoolClient = await this.pool.connect();
		try {
			await client.query("SELECT set_config('lock_timeout', $1, false)", [`${String(waitMs)}ms`]);
			await client.query("SELECT pg_advisory_lock($1, $2)", [high, low]);
		} catch (error) {
			if (error instanceof DatabaseError && error.code === LOCK_NOT_AVAILABLE) {
				await this.returnClient(client);
				return { kind: "timed_out" };
			}
			client.release(true);
			throw error;
		}
		try {
			await client.query("RESET lock_timeout");
		} catch (error) {
			// The lock is held but the session is unusable: drop it (which frees the lock) and fail this request.
			client.release(true);
			throw error;
		}
		return { kind: "locked", lock: this.heldLock(client, high, low) };
	}

	public async onModuleDestroy(): Promise<void> {
		await this.pool.end();
	}

	private heldLock(client: PoolClient, high: number, low: number): IdempotencyKeyLock {
		let released = false;
		return {
			release: async (): Promise<void> => {
				if (released) {
					return;
				}
				released = true;
				try {
					await client.query("SELECT pg_advisory_unlock($1, $2)", [high, low]);
					client.release();
				} catch (error) {
					// Ending the session frees every lock it holds.
					this.logger.warn({ event: "idempotency.unlock_failed", ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
					client.release(true);
				}
			},
		};
	}

	/** Back to the pool with the default `lock_timeout`; a session that cannot reset is dropped. */
	private async returnClient(client: PoolClient): Promise<void> {
		try {
			await client.query("RESET lock_timeout");
			client.release();
		} catch {
			client.release(true);
		}
	}
}
