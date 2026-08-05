/**
 * ── Active-subscription registry (the leak detector's eyes) ────────────────
 *
 * Every live `Subscription` registers here on construction and unregisters on
 * `unsubscribe()`. Because `Subscriber.error()`/`complete()` run `unsubscribe()`
 * internally, a terminated stream cleans itself up automatically — so in a
 * correctly-managed app this set is EMPTY at rest.
 *
 * Cost is one Set add/delete per subscription — negligible. It only ever holds
 * strong refs to LIVE subscriptions, so it observes real leaks without
 * preventing garbage collection of dead ones.
 *
 * Exposed to tests via `@workspace/reactive/testing` (`assertNoActiveSubscriptions`)
 * and usable from any React component via `useObservable`'s unmount check.
 */
const activeSubscriptions = new Set<Subscription>();

/** Number of live (not yet unsubscribed) subscriptions right now. */
export function activeSubscriptionCount(): number {
	return activeSubscriptions.size;
}

/** Live subscriptions, newest-first — for diagnostics / stack sampling. */
export function activeSubscriptionSnapshot(): readonly Subscription[] {
	return [...activeSubscriptions].reverse();
}

/**
 * Test assertion: fail loudly if any subscription is still alive.
 *
 * Call after unmounting a component / ending a test. Throws with the leak count
 * and the first few offending subscriptions so you can chase the culprit.
 *
 * @param label  Optional context string, e.g. the test name or component.
 */
export function assertNoActiveSubscriptions(label?: string): void {
	const leaks = activeSubscriptionSnapshot();
	if (leaks.length === 0) {
		return;
	}
	const context = label === undefined ? "" : ` (${label})`;
	const sample = leaks
		.slice(0, 3)
		.map((sub) => `  - ${sub.constructor.name} isClosed=${String(sub.isClosed)}`)
		.join("\n");
	throw new Error(
		`[reactive] subscription leak detected${context}: ${String(leaks.length)} subscription(s) still active.\n` +
			`Did you forget to unsubscribe (or does your component unmount before the stream ends)?\n${sample}`,
	);
}

/**
 * `Subscription` — the universal teardown handle.
 *
 * Every `subscribe()` call returns one of these. It tracks whether it is closed,
 * supports compound child teardowns (`add`/`remove`), and guarantees teardown runs
 * exactly once (idempotent `unsubscribe`).
 */
export class Subscription {
	private readonly _teardowns = new Set<() => void>();
	private readonly _childSubscriptions = new Map<Subscription, () => void>();
	private _closed = false;

	public constructor() {
		// Register with the leak-detector registry; unregistered in unsubscribe().
		activeSubscriptions.add(this);
	}

	/** True once `unsubscribe()` has run (or `error`/`complete` fired). */
	public get isClosed(): boolean {
		return this._closed;
	}

	/**
	 * Attach a child teardown. If this subscription is already closed the child
	 * teardown runs immediately (rxjs semantics — nothing added after close survives).
	 */
	public add(child: Subscription | (() => void)): void {
		if (this._closed) {
			if (typeof child === "function") {
				child();
			} else {
				child.unsubscribe();
			}
			return;
		}
		if (typeof child === "function") {
			this._teardowns.add(child);
			return;
		}
		const wrapper = (): void => {
			child.unsubscribe();
		};
		this._childSubscriptions.set(child, wrapper);
		this._teardowns.add(wrapper);
	}

	/** Detach a child before the parent closes (e.g. `switchMap` swaps inners). */
	public remove(child: Subscription | (() => void)): void {
		if (typeof child === "function") {
			this._teardowns.delete(child);
			return;
		}
		const wrapper = this._childSubscriptions.get(child);
		if (wrapper !== undefined) {
			this._childSubscriptions.delete(child);
			this._teardowns.delete(wrapper);
		}
	}

	/** Run every teardown exactly once. Calling again is a no-op. */
	public unsubscribe(): void {
		if (this._closed) {
			return;
		}
		this._closed = true;
		// Unregister from the leak registry — exactly once, thanks to the guard above.
		activeSubscriptions.delete(this);
		for (const teardown of this._teardowns) {
			teardown();
		}
		this._teardowns.clear();
		this._childSubscriptions.clear();
	}
}

/** Contract a source drives: value delivery, failure, and completion. */
export interface Observer<T> {
	/** True once the subscription has been torn down — sources check before emitting. */
	readonly isClosed: boolean;
	next(value: T): void;
	error(err: Error): void;
	complete(): void;
}

/** The call-site contract: every handler is optional. Missing ones are no-ops. */
export interface PartialObserver<T> {
	readonly next?: (value: T) => void;
	readonly error?: (err: Error) => void;
	readonly complete?: () => void;
}

/** A cleanup function returned from a subscriber function. */
export type Teardown = () => void;

/** Normalize a partial observer (or the `(next, error, complete)` overload) into one. */
export function normalizePartial<T>(observerOrNext: PartialObserver<T> | ((value: T) => void), error?: (err: Error) => void, complete?: () => void): PartialObserver<T> {
	if (typeof observerOrNext === "function") {
		return { next: observerOrNext, error, complete };
	}
	return observerOrNext;
}

/** Surface an error that no subscriber provided a handler for. */
function reportUnhandledError(err: Error): void {
	console.error("[reactive] unhandled stream error:", err);
}

/**
 * `Subscriber` — the internal observer created per subscription.
 *
 * Owns the `closed` guard (further `next/error/complete` after termination are
 * no-ops), runs teardowns on termination, and dispatches to the user handlers.
 * Extends `Subscription` so every subscriber IS its own unsubscribe handle.
 */
export class Subscriber<T> extends Subscription implements Observer<T> {
	private readonly _nextHandler?: (value: T) => void;
	private readonly _errorHandler?: (err: Error) => void;
	private readonly _completeHandler?: () => void;

	public constructor(observer: PartialObserver<T>) {
		super();
		this._nextHandler = observer.next;
		this._errorHandler = observer.error;
		this._completeHandler = observer.complete;
	}

	public next(value: T): void {
		if (this.isClosed) {
			return;
		}
		this._nextHandler?.(value);
	}

	public error(err: Error): void {
		if (this.isClosed) {
			return;
		}
		// Teardown first, then deliver — a subscriber that already cleaned up
		// must still see the error that terminated the stream.
		this.unsubscribe();
		if (this._errorHandler !== undefined) {
			this._errorHandler(err);
		} else {
			reportUnhandledError(err);
		}
	}

	public complete(): void {
		if (this.isClosed) {
			return;
		}
		this.unsubscribe();
		this._completeHandler?.();
	}
}
