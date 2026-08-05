import { Subscription } from "./subscription";

/**
 * The scheduling seam (design item 9, slimmed down).
 *
 * Every time-based operator takes a `SchedulerLike` as its last argument and
 * defaults to `asyncScheduler`, so tests can inject a virtual scheduler. All
 * schedules are ONE-SHOT and cancelable — repeating streams re-schedule
 * themselves (see `interval`).
 *
 * Leak contract: the returned Subscription MUST be closed once the action has
 * run (not just when it is cancelled). Otherwise every fired timer would leave
 * a registered-but-dead subscription behind, and the leak detector's
 * `assertNoActiveSubscriptions` would never pass. Each scheduler below honors
 * that: the handle self-closes in the same tick it executes the action.
 */
export interface SchedulerLike {
	now(): number;
	schedule(action: () => void, delayMs?: number): Subscription;
}

/** Runs actions immediately; the handle is already closed when returned. */
export const syncScheduler: SchedulerLike = {
	now(): number {
		return Date.now();
	},
	schedule(action: () => void): Subscription {
		action();
		const sub = new Subscription();
		sub.unsubscribe();
		return sub;
	},
};

/** Runs actions on `setTimeout`; cancelable via the returned subscription. */
export const asyncScheduler: SchedulerLike = {
	now(): number {
		return Date.now();
	},
	schedule(action: () => void, delayMs = 0): Subscription {
		const sub = new Subscription();
		const id = setTimeout(() => {
			if (!sub.isClosed) {
				try {
					action();
				} finally {
					// Self-close in the same tick it fires — even if the action throws,
					// the handle leaves the leak registry (no accumulated dead subs).
					sub.unsubscribe();
				}
			}
		}, delayMs);
		sub.add(() => {
			clearTimeout(id);
		});
		return sub;
	},
};
