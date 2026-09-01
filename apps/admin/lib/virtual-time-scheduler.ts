import { Subscription, type SchedulerAction, type SchedulerLike } from "rxjs";

/**
 * Virtual-time scheduler for tests (the RxJS replacement for the removed
 * `@workspace/reactive` TestScheduler).
 *
 * It implements the RxJS `SchedulerLike` contract (`now()` + `schedule()`), so
 * it can be passed as the `scheduler` argument to rxjs operators such as
 * `timer(dueTime, period, scheduler)` — while keeping the same imperative test
 * API the old custom scheduler had:
 *
 *   const s = new VirtualTimeScheduler();
 *   buildSessionBadgeStreams({ scheduler: s, ... });
 *   s.advanceBy(10_000);   // fire everything scheduled at or before this frame
 *
 * 1 frame = 1 ms of virtual time. Actions are one-shot and cancelable, matching
 * the RxJS `SchedulerAction` contract (the work function re-schedules itself
 * via `this.schedule(state, delay)`), so repeating streams (timer, interval)
 * work identically to production.
 *
 * Safety: `flush()` throws if actions remain past `TEST_MAX_FRAME` (an infinite
 * source would otherwise loop forever) — mirroring rxjs's TestScheduler.maxFrames.
 */
export const TEST_MAX_FRAME = 1000;

interface PendingEntry {
	readonly frame: number;
	/** Run the action's work (re-scheduling itself as needed). */
	readonly run: () => void;
	/** Cancel this pending registration. */
	readonly cancel: () => void;
}

export class VirtualTimeScheduler implements SchedulerLike {
	private _current = 0;
	private _queue: PendingEntry[] = [];

	public now(): number {
		return this._current;
	}

	public schedule<T>(work: (this: SchedulerAction<T>, state?: T) => void, delay = 0, state?: T): Subscription {
		const action = new VirtualAction<T>(this, work, state);
		this.pushAction(action, delay);
		return action;
	}

	/** Register (or re-register) an action at `current + delay`. */
	public pushAction<T>(action: VirtualAction<T>, delay: number): void {
		// Re-scheduling the same action (rxjs `this.schedule`) replaces its slot.
		this._queue = this._queue.filter((entry) => entry.cancel !== action.cancelRegistration);
		const frame = this._current + Math.max(0, delay);
		const entry: PendingEntry = {
			frame,
			run: (): void => {
				action.runAction();
			},
			cancel: action.cancelRegistration,
		};
		const index = this._queue.findIndex((e) => e.frame > frame);
		if (index === -1) {
			this._queue.push(entry);
		} else {
			this._queue.splice(index, 0, entry);
		}
	}

	/** Remove a pending action (teardown / leak check). */
	public cancelAction<T>(action: VirtualAction<T>): void {
		this._queue = this._queue.filter((entry) => entry.cancel !== action.cancelRegistration);
	}

	/** Run every action scheduled at or before `frame`, in order. */
	public advanceTo(frame: number): void {
		while (this._queue.length > 0 && (this._queue[0]?.frame ?? Infinity) <= frame) {
			const entry = this._queue.shift();
			if (entry === undefined) break;
			this._current = entry.frame;
			// Remove the entry from the registry BEFORE running: the action may
			// re-schedule itself (interval), and its consumed slot must already be
			// gone so only the NEW registration stays live.
			entry.run();
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
			throw new Error(`VirtualTimeScheduler.flush: ${String(this._queue.length)} action(s) pending past frame ${String(next.frame)}`);
		}
	}

	/** Number of currently pending actions — the RxJS equivalent of the old leak detector. */
	public get pendingCount(): number {
		return this._queue.length;
	}
}

/**
 * One scheduled action. Extends rxjs `Subscription` so the value returned by
 * `schedule()` doubles as the teardown handle: unsubscribing cancels any
 * pending re-registration (including the ones `this.schedule()` created).
 */
class VirtualAction<T> extends Subscription {
	private readonly _scheduler: VirtualTimeScheduler;
	private readonly _work: (this: SchedulerAction<T>, state?: T) => void;
	private _state: T | undefined;

	/** Stable identity used by the scheduler to match pending registrations. */
	public readonly cancelRegistration: () => void = (): void => {
		this._scheduler.cancelAction(this);
	};

	public constructor(scheduler: VirtualTimeScheduler, work: (this: SchedulerAction<T>, state?: T) => void, state: T | undefined) {
		super();
		this._scheduler = scheduler;
		this._work = work;
		this._state = state;
	}

	public schedule(state?: T, delay = 0): Subscription {
		this._state = state;
		this._scheduler.pushAction(this, delay);
		return this;
	}

	/** Run the work with `this` bound to the action (rxjs semantics). */
	public runAction(): void {
		this._scheduler.cancelAction(this);
		this._work.call(this, this._state);
	}

	public override unsubscribe(): void {
		this._scheduler.cancelAction(this);
		super.unsubscribe();
	}
}
