// ============================================
// platform/application/concurrency-limiter.ts — at most N tasks at once, the rest wait their turn
// ============================================
// A first-in, first-out gate for work that holds a scarce resource (a pooled database connection).
// Waiting here costs nothing; waiting inside the resource does (a transaction that cannot get a
// connection within Prisma's `maxWait` fails). The async context of each caller (its RLS session,
// its request) travels with its own task, so a queued task runs exactly as if it had not waited.

export class ConcurrencyLimiter {
	private active = 0;
	private readonly waiting: (() => void)[] = [];

	public constructor(public readonly limit: number) {
		if (!Number.isInteger(limit) || limit < 1) {
			throw new RangeError(`A concurrency limit is a whole number of at least 1 (got ${String(limit)})`);
		}
	}

	/** How many tasks are running now (at most {@link limit}). */
	public get running(): number {
		return this.active;
	}

	/** How many tasks are waiting for a turn. */
	public get queued(): number {
		return this.waiting.length;
	}

	/** Runs `work` once fewer than {@link limit} tasks are running; settles as `work` settles. */
	public async run<T>(work: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await work();
		} finally {
			this.release();
		}
	}

	private acquire(): Promise<void> {
		if (this.active < this.limit) {
			this.active += 1;
			return Promise.resolve();
		}
		return new Promise((resolve): void => {
			this.waiting.push(resolve);
		});
	}

	/** Hands the slot straight to the next waiting task (so `active` never dips and a newcomer cannot jump the queue). */
	private release(): void {
		const next: (() => void) | undefined = this.waiting.shift();
		if (next === undefined) {
			this.active -= 1;
			return;
		}
		next();
	}
}
