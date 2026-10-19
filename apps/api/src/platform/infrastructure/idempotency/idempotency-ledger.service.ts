import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { JsonValueSchema, nowEpochMs, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { IDEMPOTENCY_KEY_LOCKS, type IdempotencyKeyLock, type IdempotencyKeyLocks } from "./idempotency-key-locks";
import { IdempotencyRecordRepository, type IdempotencyLease, type IdempotencyRecordKey, type IdempotencyRecordSnapshot } from "./idempotency-record.repository";
import { IDEMPOTENCY_DUPLICATE_WAIT_MS, IDEMPOTENCY_IN_PROGRESS_LEASE_MS, IDEMPOTENCY_RETENTION_MS } from "./idempotency.constants";
import { IdempotencyKeyReusedError, IdempotencyRequestInProgressError } from "./idempotency.errors";

/** The lease of the request that executes, plus the key lock it holds until it completes or releases. */
export interface IdempotencyHeldLease extends IdempotencyLease {
	readonly lock: IdempotencyKeyLock;
}

/** Outcome of {@link IdempotencyLedgerService.begin}. */
export type IdempotencyBeginResult =
	/** This request holds the key: execute the handler, then `complete()` or `release()` with this lease. */
	| { readonly kind: "acquired"; readonly lease: IdempotencyHeldLease }
	/** An identical request already completed: return the stored body without executing. */
	| { readonly kind: "replay"; readonly responseBody: JsonValue };

/** What {@link IdempotencyLedgerService.begin} decides once it holds the key lock (before the lock is attached). */
type LockedDecision = { readonly kind: "acquired"; readonly lease: IdempotencyLease } | { readonly kind: "replay"; readonly responseBody: JsonValue };

/** Outcome of {@link IdempotencyLedgerService.complete}. */
export type IdempotencyCompleteResult = "stored" | "lease_lost";

/** Shape of an HTTP response stored by `complete()` — wrapped so a `null` body round-trips. */
const StoredHttpResponseSchema = z.object({ body: JsonValueSchema }).strict();

/**
 * Idempotency ledger for `@Idempotent()` endpoints. State machine per
 * (scope, key) — see docs/technical/api/routes.md → "Idempotency" and ADR 061:
 *
 * ```text
 * (none | expired) --begin--> IN_PROGRESS(lease token, key lock held) --complete(token)--> COMPLETED (replayed until expiresAt)
 *                                  |--release(token) (handler failed)--> expired → the next begin executes
 * same key + different request hash (unexpired)  → 409 IDEMPOTENCY_KEY_REUSED
 * same key + same hash while the original runs    → wait on the key lock (≤ 5 s), then replay
 *                                                   — or execute, if the original failed; still held → 409
 * ```
 *
 * Every `begin` first takes the key's lock, so all decisions about one key are
 * serialized across API instances. The executing request keeps the lock until
 * `complete` / `release`; a duplicate blocks on it instead of polling. Every
 * acquisition mints a fresh fencing token; `complete` and `release` succeed only
 * for the current token while the lease is live (a holder whose session died
 * loses its lock, and a successor may take the expired lease over).
 */
@Injectable()
export class IdempotencyLedgerService {
	public constructor(
		private readonly records: IdempotencyRecordRepository,
		@Inject(IDEMPOTENCY_KEY_LOCKS) private readonly locks: IdempotencyKeyLocks,
	) {}

	/**
	 * Claim `idempotencyKey` for one HTTP request, or return the stored
	 * response of an identical, completed request. Blocks (no polling) while an
	 * identical request executes, for at most {@link IDEMPOTENCY_DUPLICATE_WAIT_MS}.
	 */
	public async begin(scope: string, idempotencyKey: string, requestHash: string): Promise<IdempotencyBeginResult> {
		const key: IdempotencyRecordKey = { scope, idempotencyKey };
		const locked = await this.locks.acquire(key, IDEMPOTENCY_DUPLICATE_WAIT_MS);
		if (locked.kind === "timed_out") {
			throw new IdempotencyRequestInProgressError();
		}
		let decision: LockedDecision;
		try {
			decision = await this.decide(key, requestHash);
		} catch (error) {
			await locked.lock.release();
			throw error;
		}
		if (decision.kind === "replay") {
			await locked.lock.release();
			return decision;
		}
		return { kind: "acquired", lease: { ...decision.lease, lock: locked.lock } };
	}

	/**
	 * Under the key lock no identical request is executing in a live process, so
	 * the record alone decides: free or expired → acquire; completed → replay;
	 * another request's fingerprint → 409 reused; an unexpired IN_PROGRESS row is a
	 * holder that died mid-request → 409 in progress until its lease expires.
	 */
	private async decide(key: IdempotencyRecordKey, requestHash: string): Promise<LockedDecision> {
		const lease: IdempotencyLease = { token: randomUUID(), requestHash };
		const now: number = nowEpochMs();
		const leaseExpiresAt: number = now + IDEMPOTENCY_IN_PROGRESS_LEASE_MS;

		if (await this.records.tryAcquire(key, lease, leaseExpiresAt, now)) {
			return { kind: "acquired", lease };
		}
		const existing: IdempotencyRecordSnapshot | null = await this.records.find(key);
		if (existing === null) {
			// The retention job purged the row between the insert attempt and the read
			// (it only deletes long-expired rows). Try once more.
			if (await this.records.tryAcquire(key, lease, leaseExpiresAt, now)) {
				return { kind: "acquired", lease };
			}
			throw new IdempotencyRequestInProgressError();
		}
		if (existing.expiresAtEpochMs <= now) {
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

	/**
	 * Store the successful response of the lease holder, then release the key
	 * lock (waiting duplicates wake and replay it). `lease_lost` when the lease
	 * expired or moved on.
	 */
	public async complete(scope: string, idempotencyKey: string, lease: IdempotencyHeldLease, responseBody: JsonValue): Promise<IdempotencyCompleteResult> {
		try {
			const now: number = nowEpochMs();
			const stored: boolean = await this.records.complete({ scope, idempotencyKey }, lease, { body: responseBody }, now + IDEMPOTENCY_RETENTION_MS, now);
			return stored ? "stored" : "lease_lost";
		} finally {
			await lease.lock.release();
		}
	}

	/**
	 * Free the key after a failed request, then release the key lock: a waiting
	 * duplicate wakes and executes, and the client may retry with the same key.
	 * Only the lease holder can free the record.
	 */
	public async release(scope: string, idempotencyKey: string, lease: IdempotencyHeldLease): Promise<boolean> {
		try {
			return await this.records.release({ scope, idempotencyKey }, lease, nowEpochMs());
		} finally {
			await lease.lock.release();
		}
	}
}
