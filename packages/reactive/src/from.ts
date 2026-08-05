import { Observable } from "./observable";
import { asyncScheduler, type SchedulerLike } from "./scheduler";
import { type Subscription } from "./subscription";

/** Normalize a promise rejection reason to an Error. */
function toError(reason: Error): Error {
	return reason instanceof Error ? reason : new Error(String(reason));
}

/** Emit the given values synchronously, then complete (design item 11). */
export function of<T>(...values: readonly T[]): Observable<T> {
	return new Observable<T>((observer) => {
		for (const value of values) {
			observer.next(value);
		}
		observer.complete();
		return () => undefined;
	});
}

/** Emit each item of an iterable, then complete. */
function fromIterable<T>(iterable: Iterable<T>): Observable<T> {
	return new Observable<T>((observer) => {
		for (const value of iterable) {
			observer.next(value);
		}
		observer.complete();
		return () => undefined;
	});
}

/** Emit the resolved value (or error) of a promise (design item 13). */
export function fromPromise<T>(promise: PromiseLike<T>): Observable<T> {
	return new Observable<T>((observer) => {
		promise.then(
			(value) => {
				if (!observer.isClosed) {
					observer.next(value);
					observer.complete();
				}
			},
			(reason: Error) => {
				if (!observer.isClosed) {
					observer.error(toError(reason));
				}
			},
		);
		return () => undefined;
	});
}

/**
 * Wrap `fetch` with per-subscription `AbortController` cancellation (item 13).
 * Unsubscribing aborts the HTTP request; the abort rejection is silently dropped.
 */
export function fromFetch(url: string, init?: RequestInit): Observable<Response> {
	return new Observable<Response>((observer) => {
		const controller = new AbortController();
		fetch(url, { ...init, signal: controller.signal }).then(
			(response) => {
				if (!observer.isClosed) {
					observer.next(response);
				}
			},
			(reason: Error) => {
				if (!observer.isClosed) {
					observer.error(toError(reason));
				}
			},
		);
		return () => {
			controller.abort();
		};
	});
}

/** Wrap a DOM event listener; teardown removes it (design item 14). */
export function fromEvent<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K): Observable<HTMLElementEventMap[K]>;
export function fromEvent(target: EventTarget, type: string): Observable<Event>;
export function fromEvent(target: EventTarget, type: string): Observable<Event> {
	return new Observable<Event>((observer) => {
		const handler = (event: Event): void => {
			observer.next(event);
		};
		target.addEventListener(type, handler);
		return () => {
			target.removeEventListener(type, handler);
		};
	});
}

/** Normalize any value into an observable (design item 12). */
export function from<T>(source: Observable<T> | PromiseLike<T> | Iterable<T>): Observable<T> {
	if (source instanceof Observable) {
		return source;
	}
	if ("then" in source) {
		return fromPromise(source);
	}
	return fromIterable(source);
}

/**
 * Combine multiple observables into one — every value from every source is
 * forwarded, interleaved by arrival (design item 24). Completes when ALL
 * sources complete; errors propagate immediately and tear down every source.
 * The classic trigger-union: `merge(timer(0, POLL), visibleChanges)`.
 */
export function merge<A, B>(a: Observable<A>, b: Observable<B>): Observable<A | B>;
export function merge<A, B, C>(a: Observable<A>, b: Observable<B>, c: Observable<C>): Observable<A | B | C>;
export function merge<A, B, C, D>(a: Observable<A>, b: Observable<B>, c: Observable<C>, d: Observable<D>): Observable<A | B | C | D>;
export function merge<T>(...sources: readonly Observable<T>[]): Observable<T>;
export function merge<T>(...sources: readonly Observable<T>[]): Observable<T> {
	return new Observable<T>((observer) => {
		if (sources.length === 0) {
			observer.complete();
			return () => undefined;
		}
		let remaining = sources.length;
		const subs: Subscription[] = sources.map((source) =>
			source.subscribe({
				next: (value) => {
					observer.next(value);
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					remaining -= 1;
					if (remaining === 0) {
						observer.complete();
					}
				},
			}),
		);
		return () => {
			for (const sub of subs) {
				sub.unsubscribe();
			}
		};
	});
}

/** Emit 0, 1, 2, … every `periodMs` (design item 15). Re-schedules itself. */
export function interval(periodMs: number, scheduler: SchedulerLike = asyncScheduler): Observable<number> {
	return new Observable<number>((observer) => {
		let count = 0;
		let handle: Subscription | null = null;
		const tick = (): void => {
			if (observer.isClosed) {
				return;
			}
			observer.next(count);
			count += 1;
			handle = scheduler.schedule(tick, periodMs);
		};
		handle = scheduler.schedule(tick, periodMs);
		return () => {
			handle?.unsubscribe();
		};
	});
}

/** Emit once after `delayMs`, or every `periodMs` after the initial delay (item 15). */
export function timer(delayMs: number, periodMs?: number, scheduler: SchedulerLike = asyncScheduler): Observable<number> {
	return new Observable<number>((observer) => {
		if (periodMs === undefined) {
			const handle = scheduler.schedule(() => {
				observer.next(0);
				observer.complete();
			}, delayMs);
			return () => {
				handle.unsubscribe();
			};
		}
		let count = 0;
		let handle: Subscription | null = null;
		const tick = (): void => {
			if (observer.isClosed) {
				return;
			}
			observer.next(count);
			count += 1;
			handle = scheduler.schedule(tick, periodMs);
		};
		handle = scheduler.schedule(tick, delayMs);
		return () => {
			handle?.unsubscribe();
		};
	});
}
