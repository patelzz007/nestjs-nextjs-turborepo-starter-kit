import { type SchedulerLike } from "../scheduler";
import { Subscription } from "../subscription";

interface ScheduledAction {
	readonly frame: number;
	readonly run: () => void;
	readonly cancel: () => void;
	/** The handle returned from `schedule()` — closed the moment the action fires. */
	readonly subscription: Subscription;
}

/**
 * Virtual-time scheduler for tests (design Part 8½).
 *
 * 1 frame = 1 ms of virtual time. Actions are one-shot and cancelable, matching
 * the production `SchedulerLike` contract, so repeating streams (interval,
 * timer) work identically — they re-schedule themselves.
 *
 * Safety: `flush()` throws if actions remain past `MAX_FRAME` (an infinite
 * source would otherwise loop forever) — mirroring rxjs's TestScheduler.maxFrames.
 *
 * Leak contract (same as `asyncScheduler`): each action's handle is closed the
 * moment it FIRES, not only when cancelled — so a test that advances virtual
 * time leaves zero registered subscriptions behind, and
 * `assertNoActiveSubscriptions()` stays green.
 */
export const TEST_MAX_FRAME = 1000;

export class TestScheduler implements SchedulerLike {
	private _current = 0;
	private readonly _queue: ScheduledAction[] = [];

	public now(): number {
		return this._current;
	}

	public schedule(action: () => void, delayMs = 0): Subscription {
		const frame = this._current + Math.max(0, delayMs);
		const sub = new Subscription();
		const entry: ScheduledAction = {
			frame,
			run: action,
			cancel: () => {
				const index = this._queue.indexOf(entry);
				if (index >= 0) {
					this._queue.splice(index, 1);
				}
			},
			subscription: sub,
		};
		sub.add(entry.cancel);
		this._queue.push(entry);
		this._queue.sort((a, b) => a.frame - b.frame);
		return sub;
	}

	/** Run every action scheduled at or before `frame`, in order. */
	public advanceTo(frame: number): void {
		let next: ScheduledAction | undefined = this._queue[0];
		while (next !== undefined && next.frame <= frame) {
			this._queue.shift();
			this._current = next.frame;
			// Close the handle BEFORE running: the action may re-schedule
			// itself (interval), and its consumed entry must already be gone
			// from the registry so only the NEW handle stays live.
			next.subscription.unsubscribe();
			next.run();
			next = this._queue[0];
		}
		this._current = Math.max(this._current, frame);
	}

	/** Advance by `frames` virtual milliseconds. */
	public advanceBy(frames: number): void {
		this.advanceTo(this._current + frames);
	}

	/**
	 * Run everything up to `TEST_MAX_FRAME`, then assert nothing is pending.
	 * Throws on pending actions — the scheduler-level leak check.
	 */
	public flush(): void {
		this.advanceTo(TEST_MAX_FRAME);
		const next = this._queue[0];
		if (next !== undefined) {
			throw new Error(`TestScheduler.flush: ${String(this._queue.length)} action(s) pending past frame ${String(next.frame)}`);
		}
	}
}
