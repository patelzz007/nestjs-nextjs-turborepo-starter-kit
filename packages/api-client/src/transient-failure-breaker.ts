// ============================================
// transient-failure-breaker.ts - one cooldown model for every refresh
// ============================================
// Runtime-neutral (no browser, Node or Next.js APIs), so the client-side
// refresh cooldown (`refresh.ts`: the browser's cookie refresh and the mobile
// body-token refresh) and the web route proxy's refresh
// (`@workspace/client`, `lib/auth/edge/proxy-refresh.ts`) share it.
//
// Two separate questions, two separate answers:
// - "Did THIS session's refresh just fail transiently?" → a per-key cooldown.
//   One member's failing refresh never delays another member's (the proxy
//   serves every user from one process).
// - "Is the API down?" → a circuit that opens only after `circuitThreshold`
//   transient failures (across keys) inside `circuitWindowMs`, and then skips
//   every refresh for `cooldownMs` — a dead API is not hammered.
// A dead SESSION (401/403) is not a transient failure: it settles the key.

export interface TransientFailureBreakerOptions {
	/** How long a key (and an open circuit) waits after a transient failure. */
	readonly cooldownMs: number;
	/** Transient failures (any keys) inside `circuitWindowMs` that open the circuit. `1` = any failure opens it (one-key callers). */
	readonly circuitThreshold: number;
	readonly circuitWindowMs: number;
	/** Upper bound of tracked keys, so the map cannot grow without limit in a long-lived process. */
	readonly maxTrackedKeys: number;
	/** Clock (epoch ms) — `Date.now` by default, a fake in tests. */
	readonly now?: (() => number) | undefined;
}

export interface TransientFailureBreaker {
	/** True while `key` (or the whole circuit) is cooling down: skip the call. */
	readonly isCoolingDown: (key: string) => boolean;
	/** The call for `key` failed transiently (network, timeout, 5xx). */
	readonly recordTransientFailure: (key: string) => void;
	/** The call for `key` reached a verdict (success or a dead session): forget its cooldown and close the circuit. */
	readonly recordSettled: (key: string) => void;
	readonly reset: () => void;
}

export function createTransientFailureBreaker(options: TransientFailureBreakerOptions): TransientFailureBreaker {
	// Read `Date.now` at call time (never a captured reference), so a replaced clock is honoured.
	const now: () => number = options.now ?? ((): number => Date.now());
	const failedAt = new Map<string, number>();
	let recentFailures: number[] = [];
	let circuitOpenedAt: number | null = null;

	const isRecent = (at: number, windowMs: number): boolean => now() - at < windowMs;

	const prune = (): void => {
		for (const [key, at] of failedAt) {
			if (!isRecent(at, options.cooldownMs)) failedAt.delete(key);
		}
		// Map iteration is insertion order: the oldest entries go first.
		for (const key of failedAt.keys()) {
			if (failedAt.size <= options.maxTrackedKeys) break;
			failedAt.delete(key);
		}
	};

	return {
		isCoolingDown: (key: string): boolean => {
			if (circuitOpenedAt !== null && isRecent(circuitOpenedAt, options.cooldownMs)) return true;
			const at: number | undefined = failedAt.get(key);
			return at !== undefined && isRecent(at, options.cooldownMs);
		},
		recordTransientFailure: (key: string): void => {
			const at: number = now();
			failedAt.delete(key);
			failedAt.set(key, at);
			recentFailures = [...recentFailures.filter((failure: number): boolean => isRecent(failure, options.circuitWindowMs)), at];
			if (recentFailures.length >= options.circuitThreshold) {
				circuitOpenedAt = at;
			}
			prune();
		},
		recordSettled: (key: string): void => {
			failedAt.delete(key);
			recentFailures = [];
			circuitOpenedAt = null;
		},
		reset: (): void => {
			failedAt.clear();
			recentFailures = [];
			circuitOpenedAt = null;
		},
	};
}
