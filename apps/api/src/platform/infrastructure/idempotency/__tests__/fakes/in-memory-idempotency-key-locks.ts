import type { IdempotencyKeyLock, IdempotencyKeyLockOutcome, IdempotencyKeyLocks } from "../../idempotency-key-locks";
import type { IdempotencyRecordKey } from "../../idempotency-record.repository";

/** One request waiting for a key's lock. */
interface Waiter {
	readonly grant: (outcome: IdempotencyKeyLockOutcome) => void;
	readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * A real {@link IdempotencyKeyLocks} in memory with advisory-lock semantics:
 * one holder per key, waiters queue in order and wake on release (no polling),
 * and a waiter still queued after `waitMs` times out. `dropAll()` plays a
 * process crash: every held lock vanishes with its session, the records stay.
 */
export class InMemoryIdempotencyKeyLocks implements IdempotencyKeyLocks {
	public acquisitions = 0;
	/** The current holder's grant number per key: a lock released or dropped earlier can never free its successor. */
	private readonly held: Map<string, number> = new Map<string, number>();
	private grants = 0;
	private readonly waiters: Map<string, Waiter[]> = new Map<string, Waiter[]>();

	public acquire(key: IdempotencyRecordKey, waitMs: number): Promise<IdempotencyKeyLockOutcome> {
		this.acquisitions += 1;
		const id = `${key.scope}|${key.idempotencyKey}`;
		if (!this.held.has(id)) {
			return Promise.resolve({ kind: "locked", lock: this.grant(id) });
		}
		return new Promise<IdempotencyKeyLockOutcome>((resolve): void => {
			const queue: Waiter[] = this.waiters.get(id) ?? [];
			const waiter: Waiter = {
				grant: resolve,
				timer: setTimeout((): void => {
					this.waiters.set(
						id,
						(this.waiters.get(id) ?? []).filter((queued: Waiter): boolean => queued !== waiter),
					);
					resolve({ kind: "timed_out" });
				}, waitMs),
			};
			queue.push(waiter);
			this.waiters.set(id, queue);
		});
	}

	/** Number of requests currently blocked on `key`. */
	public waiting(key: IdempotencyRecordKey): number {
		return this.waiters.get(`${key.scope}|${key.idempotencyKey}`)?.length ?? 0;
	}

	/** Every held lock vanishes (sessions ended); queued waiters are handed the lock in order. */
	public dropAll(): void {
		for (const id of [...this.held.keys()]) {
			this.handOver(id);
		}
	}

	private grant(id: string): IdempotencyKeyLock {
		this.grants += 1;
		const grant: number = this.grants;
		this.held.set(id, grant);
		return {
			release: (): Promise<void> => {
				if (this.held.get(id) === grant) {
					this.handOver(id);
				}
				return Promise.resolve();
			},
		};
	}

	private handOver(id: string): void {
		const [next, ...rest] = this.waiters.get(id) ?? [];
		this.waiters.set(id, rest);
		if (next === undefined) {
			this.held.delete(id);
			return;
		}
		clearTimeout(next.timer);
		next.grant({ kind: "locked", lock: this.grant(id) });
	}
}
