import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { JsonValueSchema, nowEpochMs, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { IdempotencyRecordRepository, type IdempotencyLease, type IdempotencyRecordKey, type IdempotencyRecordSnapshot } from "./idempotency-record.repository";
import { IDEMPOTENCY_IN_PROGRESS_LEASE_MS, IDEMPOTENCY_RETENTION_MS } from "./idempotency.constants";
import { IdempotencyKeyReusedError, IdempotencyRequestInProgressError } from "./idempotency.errors";

/** Outcome of {@link IdempotencyLedgerService.begin}. */
export type IdempotencyBeginResult =
	/** This request holds the key: execute the handler, then `complete()` or `release()` with this lease. */
	| { readonly kind: "acquired"; readonly lease: IdempotencyLease }
	/** An identical request already completed: return the stored body without executing. */
	| { readonly kind: "replay"; readonly responseBody: JsonValue };

/** Outcome of {@link IdempotencyLedgerService.complete}. */
export type IdempotencyCompleteResult = "stored" | "lease_lost";

/** Shape of an HTTP response stored by `complete()` — wrapped so a `null` body round-trips. */
const StoredHttpResponseSchema = z.object({ body: JsonValueSchema }).strict();

/**
 * Idempotency ledger for `@Idempotent()` endpoints. State machine per
 * (scope, key) — see docs/technical/api/routes.md → "Idempotency":
 *
 * ```text
 * (none | expired) --begin--> IN_PROGRESS(lease token) --complete(token)--> COMPLETED (replayed until expiresAt)
 *                                  |--release(token) (handler failed)--> expired → next begin re-executes
 * same key + different request hash (unexpired)  → 409 IDEMPOTENCY_KEY_REUSED
 * same key + same hash while IN_PROGRESS          → 409 IDEMPOTENCY_REQUEST_IN_PROGRESS
 * ```
 *
 * Every acquisition mints a fresh fencing token; `complete` and `release`
 * succeed only for the current token while the lease is live.
 */
@Injectable()
export class IdempotencyLedgerService {
	public constructor(private readonly records: IdempotencyRecordRepository) {}

	/**
	 * Claim `idempotencyKey` for one HTTP request, or return the stored
	 * response of an identical, completed request. Race-safe: the unique
	 * (scope, key) index lets exactly one concurrent request acquire the key,
	 * and an expired row is taken over by a conditional update.
	 */
	public async begin(scope: string, idempotencyKey: string, requestHash: string): Promise<IdempotencyBeginResult> {
		const key: IdempotencyRecordKey = { scope, idempotencyKey };
		const lease: IdempotencyLease = { token: randomUUID(), requestHash };
		const now: number = nowEpochMs();
		const leaseExpiresAt: number = now + IDEMPOTENCY_IN_PROGRESS_LEASE_MS;

		if (await this.records.tryAcquire(key, lease, leaseExpiresAt, now)) {
			return { kind: "acquired", lease };
		}

		const existing: IdempotencyRecordSnapshot | null = await this.records.find(key);
		if (existing === null) {
			// The row vanished between the insert attempt and the read — the
			// retention job purged it (it only deletes long-expired rows). Try
			// once more; losing again means another request acquired it first.
			if (await this.records.tryAcquire(key, lease, leaseExpiresAt, now)) {
				return { kind: "acquired", lease };
			}
			throw new IdempotencyRequestInProgressError();
		}
		if (existing.expiresAtEpochMs <= now) {
			// Lease abandoned / replay window over: exactly one contender wins the takeover.
			if (await this.records.takeOverExpired(key, lease, leaseExpiresAt, now)) {
				return { kind: "acquired", lease };
			}
			throw new IdempotencyRequestInProgressError();
		}
		if (existing.requestHash !== requestHash) {
			throw new IdempotencyKeyReusedError();
		}
		if (existing.status === "IN_PROGRESS") {
			throw new IdempotencyRequestInProgressError();
		}
		return { kind: "replay", responseBody: StoredHttpResponseSchema.parse(existing.responseBody).body };
	}

	/** Store the successful response of the lease holder. `lease_lost` when the lease expired or moved on. */
	public async complete(scope: string, idempotencyKey: string, lease: IdempotencyLease, responseBody: JsonValue): Promise<IdempotencyCompleteResult> {
		const now: number = nowEpochMs();
		const stored: boolean = await this.records.complete({ scope, idempotencyKey }, lease, { body: responseBody }, now + IDEMPOTENCY_RETENTION_MS, now);
		return stored ? "stored" : "lease_lost";
	}

	/** Free the key after a failed request so the client can retry with the same key. Only the lease holder can. */
	public async release(scope: string, idempotencyKey: string, lease: IdempotencyLease): Promise<boolean> {
		return this.records.release({ scope, idempotencyKey }, lease, nowEpochMs());
	}
}
