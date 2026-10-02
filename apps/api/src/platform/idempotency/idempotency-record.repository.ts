import { Injectable } from "@nestjs/common";
import { Prisma, type IdempotencyRecordStatus } from "@prisma/client";
import { JsonValueSchema, type JsonObject, type JsonValue } from "@workspace/shared";

import { parsePrismaInputJson } from "../../common/utils/prisma-json";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { IDEMPOTENCY_RETENTION_OPERATION, IDEMPOTENCY_SYSTEM_OPERATION } from "./idempotency.constants";

/** Transaction client handed to `withSystemOperation` handlers (derived — the service does not export it). */
type SystemTransactionClient = Parameters<Parameters<TenantTransactionService["withSystemOperation"]>[1]>[0];

/** Prisma: unique constraint violated — another request inserted the same (scope, key) first. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** Persistence-agnostic view of one idempotency record. */
export interface IdempotencyRecordSnapshot {
	readonly requestHash: string;
	readonly status: IdempotencyRecordStatus;
	/** Stored response (null while IN_PROGRESS). */
	readonly responseBody: JsonValue | null;
	readonly expiresAtEpochMs: number;
}

/** Identifies one key inside one scope. */
export interface IdempotencyRecordKey {
	readonly scope: string;
	readonly idempotencyKey: string;
}

/**
 * Prisma access for `platform_resource_idempotency_records`.
 *
 * The table is RLS bypass-only (prisma/rls/manifest-index.ts), so every
 * statement runs in its own transaction under the allowlisted
 * `http.idempotency` system operation. Requests never delete rows: an
 * expired row (lease or replay window over) is taken over in place. Only the
 * retention job (`IdempotencyRetentionService`) deletes, and only rows expired
 * for longer than its grace period, under `idempotency.retention`.
 */
/**
 * The slice of a transaction client the in-transaction writes need. Narrower
 * than `Prisma.TransactionClient`, so every transaction client in the API
 * (plain `$transaction`, tenant or system operation) satisfies it.
 */
export type IdempotencyRecordWriter = Pick<Prisma.TransactionClient, "platformResourceIdempotencyRecord">;

@Injectable()
export class IdempotencyRecordRepository {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/** Insert an IN_PROGRESS row. Returns `false` when the (scope, key) row already exists. */
	public async tryAcquire(key: IdempotencyRecordKey, requestHash: string, leaseExpiresAtEpochMs: number, nowEpochMs: number): Promise<boolean> {
		try {
			await this.run(key, "Acquire idempotency key", async (tx) =>
				tx.platformResourceIdempotencyRecord.create({
					data: {
						scope: key.scope,
						idempotencyKey: key.idempotencyKey,
						requestHash,
						status: "IN_PROGRESS",
						expiresAt: BigInt(leaseExpiresAtEpochMs),
						createdAt: BigInt(nowEpochMs),
						updatedAt: BigInt(nowEpochMs),
					},
				}),
			);
			return true;
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
				return false;
			}
			throw error;
		}
	}

	public async find(key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> {
		const row = await this.run(key, "Read idempotency key", async (tx) =>
			tx.platformResourceIdempotencyRecord.findUnique({
				where: { scope_idempotencyKey: { scope: key.scope, idempotencyKey: key.idempotencyKey } },
				select: { requestHash: true, status: true, responseBody: true, expiresAt: true },
			}),
		);
		if (row === null) {
			return null;
		}
		return {
			requestHash: row.requestHash,
			status: row.status,
			responseBody: row.responseBody === null ? null : JsonValueSchema.parse(row.responseBody),
			expiresAtEpochMs: Number(row.expiresAt),
		};
	}

	/**
	 * Atomically claim an EXPIRED row for a new request (conditional update —
	 * race-safe: of two concurrent takeovers exactly one sees `count === 1`).
	 */
	public async takeOverExpired(key: IdempotencyRecordKey, requestHash: string, leaseExpiresAtEpochMs: number, nowEpochMs: number): Promise<boolean> {
		const result = await this.run(key, "Take over expired idempotency key", async (tx) =>
			tx.platformResourceIdempotencyRecord.updateMany({
				where: { scope: key.scope, idempotencyKey: key.idempotencyKey, expiresAt: { lte: BigInt(nowEpochMs) } },
				data: { requestHash, status: "IN_PROGRESS", responseBody: Prisma.DbNull, expiresAt: BigInt(leaseExpiresAtEpochMs), updatedAt: BigInt(nowEpochMs) },
			}),
		);
		return result.count === 1;
	}

	/** Store the response of the request that holds the lease. Returns `false` if the lease was lost. */
	public async complete(key: IdempotencyRecordKey, requestHash: string, responseBody: JsonObject, retainUntilEpochMs: number, nowEpochMs: number): Promise<boolean> {
		const result = await this.run(key, "Store idempotent response", async (tx) =>
			tx.platformResourceIdempotencyRecord.updateMany({
				where: { scope: key.scope, idempotencyKey: key.idempotencyKey, requestHash, status: "IN_PROGRESS" },
				data: { status: "COMPLETED", responseBody: parsePrismaInputJson(responseBody), expiresAt: BigInt(retainUntilEpochMs), updatedAt: BigInt(nowEpochMs) },
			}),
		);
		return result.count === 1;
	}

	/** Free the lease early (the request failed) by expiring it now — the next attempt takes it over. */
	public async release(key: IdempotencyRecordKey, requestHash: string, nowEpochMs: number): Promise<void> {
		await this.run(key, "Release idempotency key", async (tx) =>
			tx.platformResourceIdempotencyRecord.updateMany({
				where: { scope: key.scope, idempotencyKey: key.idempotencyKey, requestHash, status: "IN_PROGRESS" },
				data: { expiresAt: BigInt(nowEpochMs), updatedAt: BigInt(nowEpochMs) },
			}),
		);
	}

	/**
	 * Insert an already-COMPLETED record inside the CALLER's transaction —
	 * used by `PlatformResourceMutationService.runMutation`, where the record
	 * must commit atomically with the business write. The caller's
	 * transaction must run with an RLS bypass (system operation).
	 *
	 * An EXPIRED record for the same key (not yet purged by the retention job)
	 * is removed first: `findReplay` already treats it as unused, so the key
	 * may legitimately be reused. A live record is left alone, so a genuinely
	 * concurrent request still fails on the unique (scope, key) index.
	 */
	public async insertCompleted(
		tx: IdempotencyRecordWriter,
		key: IdempotencyRecordKey,
		requestHash: string,
		responseBody: JsonObject,
		retainUntilEpochMs: number,
		nowEpochMs: number,
	): Promise<void> {
		await tx.platformResourceIdempotencyRecord.deleteMany({
			where: { scope: key.scope, idempotencyKey: key.idempotencyKey, expiresAt: { lte: BigInt(nowEpochMs) } },
		});
		await tx.platformResourceIdempotencyRecord.create({
			data: {
				scope: key.scope,
				idempotencyKey: key.idempotencyKey,
				requestHash,
				status: "COMPLETED",
				responseBody: parsePrismaInputJson(responseBody),
				expiresAt: BigInt(retainUntilEpochMs),
			},
		});
	}

	/**
	 * Delete up to `batchSize` records whose `expiresAt` is before
	 * `cutoffEpochMs` (oldest first, via the `expires_at` index). Returns the
	 * number deleted. Race-safe against a concurrent takeover: the DELETE
	 * re-checks `expiresAt` on the row it locks, so a row that a request just
	 * took over (new lease in the future) is never deleted.
	 */
	public async deleteExpiredBefore(cutoffEpochMs: number, batchSize: number): Promise<number> {
		const cutoff = BigInt(cutoffEpochMs);
		return this.tenantTx.withSystemOperation(
			{ operation: IDEMPOTENCY_RETENTION_OPERATION, reason: "Purge expired idempotency records", correlationId: "idempotency:retention", actorUserId: null },
			async (tx): Promise<number> => {
				const expired = await tx.platformResourceIdempotencyRecord.findMany({
					where: { expiresAt: { lt: cutoff } },
					orderBy: { expiresAt: "asc" },
					take: batchSize,
					select: { id: true },
				});
				if (expired.length === 0) {
					return 0;
				}
				const result = await tx.platformResourceIdempotencyRecord.deleteMany({
					where: { id: { in: expired.map((row): string => row.id) }, expiresAt: { lt: cutoff } },
				});
				return result.count;
			},
		);
	}

	private async run<T>(key: IdempotencyRecordKey, reason: string, handler: (tx: SystemTransactionClient) => Promise<T>): Promise<T> {
		return this.tenantTx.withSystemOperation(
			{ operation: IDEMPOTENCY_SYSTEM_OPERATION, reason, correlationId: `idempotency:${key.scope}:${key.idempotencyKey}`, actorUserId: null },
			handler,
		);
	}
}
