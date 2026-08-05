import { Observable } from "./observable";
import { type Operator } from "./pipe";
import { asyncScheduler, type SchedulerLike } from "./scheduler";
import { Subscription, type Observer } from "./subscription";

/** Transform every value (design item 19). */
export function map<T, R>(project: (value: T) => R): Operator<T, R> {
	return (source: Observable<T>): Observable<R> =>
		new Observable<R>((observer) => {
			const sub = source.subscribe({
				next: (value) => {
					observer.next(project(value));
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
			};
		});
}

/**
 * Keep values that pass the predicate (design item 27).
 *
 * rxjs-faithful: the predicate receives the source index (`0`-based), which
 * increments on EVERY source emission, not just passing ones.
 *
 * The type-guard overload (rxjs's `filter<S extends T>`) lets downstream
 * operators see the narrowed type — e.g. `filter((s) => s.status === "ready")`
 * on a discriminated union makes `s.session` type-check afterwards. Without
 * it, every consumer would need a manual re-check (the classic rxjs + TS pain).
 */
export function filter<T, S extends T>(predicate: (value: T, index: number) => value is S): Operator<T, S>;
export function filter<T>(predicate: (value: T, index: number) => boolean): Operator<T, T>;
export function filter<T>(predicate: (value: T, index: number) => boolean): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			let index = 0;
			const sub = source.subscribe({
				next: (value) => {
					if (predicate(value, index)) {
						observer.next(value);
					}
					index += 1;
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
			};
		});
}

/**
 * Prepend value(s) synchronously on subscribe, then forward the source
 * (the standard way to seed a stream with an initial value — e.g. a
 * `visibilitychange` stream needs `startWith(true)` so the first subscriber
 * sees the CURRENT visibility without waiting for an event).
 */
export function startWith<T>(...values: readonly T[]): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			for (const value of values) {
				observer.next(value);
			}
			const sub = source.subscribe({
				next: (value) => {
					observer.next(value);
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
			};
		});
}

/**
 * Multicast + replay — the cache operator (design item 49, now SHIPPED because
 * the session badge needs it).
 *
 * The first subscriber runs the cold source ONCE; every subscriber (current AND
 * future) gets the last `bufferSize` values replayed synchronously on subscribe,
 * then live values. When the LAST subscriber leaves, the source is torn down
 * (refCount) — re-subscribing later re-runs the source with the buffer retained.
 *
 * Why: without it, three components subscribing to the same cold stream would
 * start THREE fetch pipelines (three timers, three HTTP calls). `shareReplay(1)`
 * at the pipeline root collapses that to one, shared by all.
 */
export function shareReplay<T>(bufferSize = 1): Operator<T, T> {
	return (source: Observable<T>): Observable<T> => {
		let sourceSub: Subscription | null = null;
		let buffer: T[] = [];
		let hasCompleted = false;
		let hasError = false;
		let currentError: Error | null = null;
		let subscriberCount = 0;
		const subscribers = new Set<Observer<T>>();

		return new Observable<T>((observer) => {
			// Replay the buffer synchronously, then terminal states for late subscribers.
			for (const value of buffer) {
				observer.next(value);
			}
			if (hasCompleted) {
				observer.complete();
				return () => undefined;
			}
			if (hasError) {
				observer.error(currentError ?? new Error("shared stream failed"));
				return () => undefined;
			}

			subscribers.add(observer);
			subscriberCount += 1;
			// Subscribe the source BEFORE returning — synchronous emissions land in
			// `subscribers` (this observer is already in it) AND in the buffer.
			sourceSub ??= source.subscribe({
				next: (value) => {
					buffer = [...buffer, value].slice(-bufferSize);
					for (const subscriber of [...subscribers]) {
						subscriber.next(value);
					}
				},
				error: (err) => {
					hasError = true;
					// Keep the FIRST error (later errors can't overwrite the terminal state).
					currentError ??= err;
					for (const subscriber of [...subscribers]) {
						subscriber.error(err);
					}
				},
				complete: () => {
					hasCompleted = true;
					for (const subscriber of [...subscribers]) {
						subscriber.complete();
					}
				},
			});
			return () => {
				subscribers.delete(observer);
				subscriberCount -= 1;
				if (subscriberCount === 0 && sourceSub !== null) {
					const sub = sourceSub;
					sourceSub = null;
					sub.unsubscribe();
				}
			};
		});
	};
}

/**
 * Suppress consecutive duplicates — emit only when the value CHANGES.
 *
 * Without a comparator, equality is `===` (rxjs default). The comparator
 * receives `(previous, current)` where `previous` is the last SEEN value
 * (rxjs-faithful: even values that were suppressed update the baseline).
 */
export function distinctUntilChanged<T>(comparator?: (previous: T, current: T) => boolean): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			let hasPrevious = false;
			let previous: T;
			const sub = source.subscribe({
				next: (value) => {
					// Assign BEFORE comparing — this both satisfies TS flow analysis and
					// mirrors rxjs (the comparison baseline updates on every emission).
					const isDuplicate = hasPrevious ? (comparator === undefined ? previous === value : comparator(previous, value)) : false;
					previous = value;
					hasPrevious = true;
					if (!isDuplicate) {
						observer.next(value);
					}
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
			};
		});
}

/** Cancel the previous inner on every outer value — the "latest wins" operator (item 20). */
export function switchMap<T, R>(project: (value: T) => Observable<R>): Operator<T, R> {
	return (source: Observable<T>): Observable<R> =>
		new Observable<R>((observer) => {
			let innerSub: Subscription | null = null;
			let outerCompleted = false;

			const subscribeInner = (value: T): void => {
				innerSub?.unsubscribe();
				innerSub = project(value).subscribe({
					next: (v) => {
						observer.next(v);
					},
					error: (err) => {
						innerSub = null;
						observer.error(err);
					},
					complete: () => {
						innerSub = null;
						if (outerCompleted) {
							observer.complete();
						}
					},
				});
			};

			const outerSub = source.subscribe({
				next: subscribeInner,
				error: (err) => {
					innerSub?.unsubscribe();
					innerSub = null;
					observer.error(err);
				},
				complete: () => {
					// rxjs semantics: an outer complete waits for the active inner to
					// finish before the stream completes downstream.
					outerCompleted = true;
					if (innerSub === null) {
						observer.complete();
					}
				},
			});

			return () => {
				outerSub.unsubscribe();
				innerSub?.unsubscribe();
			};
		});
}

/** Emit exactly `count` values, then complete (design item 28). */
export function take<T>(count: number): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			if (count <= 0) {
				observer.complete();
				return () => undefined;
			}
			let remaining = count;
			// `let` + `?.` (not `const`) so a synchronously-emitting source (of,
			// from, BehaviorSubject) can unsubscribe mid-subscribe without a TDZ crash.
			let sub: Subscription | null = null;
			sub = source.subscribe({
				next: (value) => {
					remaining -= 1;
					observer.next(value);
					if (remaining === 0) {
						observer.complete();
						sub?.unsubscribe();
					}
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			// The teardown only ever runs after `sub` is assigned.
			return () => {
				sub.unsubscribe();
			};
		});
}

/** Emit while the predicate holds, then complete (design item 28). */
export function takeWhile<T>(predicate: (value: T) => boolean, inclusive = false): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			// `let` + `?.` so a synchronously-emitting source can complete mid-subscribe.
			let sub: Subscription | null = null;
			sub = source.subscribe({
				next: (value) => {
					if (predicate(value)) {
						observer.next(value);
						return;
					}
					if (inclusive) {
						observer.next(value);
					}
					observer.complete();
					sub?.unsubscribe();
				},
				error: (err) => {
					observer.error(err);
				},
				complete: () => {
					observer.complete();
				},
			});
			// The teardown only ever runs after `sub` is assigned.
			return () => {
				sub.unsubscribe();
			};
		});
}

/** Emit until the notifier fires, then complete (the cleanup workhorse — item 28). */
export function takeUntil<T, B>(notifier: Observable<B>): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			// The notifier is subscribed FIRST so that a synchronously-completing
			// source can tear it down in its complete handler (no dangling notifier),
			// and `sourceSub` is `let`+`?.` so a synchronous notifier (BehaviorSubject)
			// firing mid-subscribe cannot hit a TDZ (unsubscribe-guarantee Rule 3).
			let sourceSub: Subscription | null = null;
			const notifierSub = notifier.subscribe({
				next: () => {
					sourceSub?.unsubscribe();
					observer.complete();
				},
				error: (err) => {
					observer.error(err);
				},
			});
			if (observer.isClosed) {
				// A synchronous notifier already completed the stream — nothing to keep.
				return () => undefined;
			}
			sourceSub = source.subscribe({
				next: (value) => {
					observer.next(value);
				},
				error: (err) => {
					notifierSub.unsubscribe();
					observer.error(err);
				},
				complete: () => {
					notifierSub.unsubscribe();
					observer.complete();
				},
			});
			return () => {
				sourceSub.unsubscribe();
				notifierSub.unsubscribe();
			};
		});
}

/**
 * Emit the latest value only after `dueTimeMs` of silence (design item 32).
 *
 * rxjs-faithful edge case: a value still pending when the source completes is
 * DROPPED (debounceTime does not flush the trailing value on completion).
 */
export function debounceTime<T>(dueTimeMs: number, scheduler: SchedulerLike = asyncScheduler): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			let pending: Subscription | null = null;
			let hasValue = false;
			let latestValue: T;

			const sub = source.subscribe({
				next: (value) => {
					latestValue = value;
					hasValue = true;
					pending?.unsubscribe();
					pending = scheduler.schedule(() => {
						pending = null;
						if (hasValue) {
							hasValue = false;
							observer.next(latestValue);
						}
					}, dueTimeMs);
				},
				error: (err) => {
					pending?.unsubscribe();
					pending = null;
					observer.error(err);
				},
				complete: () => {
					pending?.unsubscribe();
					pending = null;
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
				pending?.unsubscribe();
			};
		});
}

/** Emit at most one value per `throttleMs`, leading edge (design item 32). */
export function throttleTime<T>(throttleMs: number, scheduler: SchedulerLike = asyncScheduler): Operator<T, T> {
	return (source: Observable<T>): Observable<T> =>
		new Observable<T>((observer) => {
			let throttled = false;
			let window: Subscription | null = null;

			const sub = source.subscribe({
				next: (value) => {
					if (throttled) {
						return;
					}
					throttled = true;
					observer.next(value);
					window = scheduler.schedule(() => {
						throttled = false;
						window = null;
					}, throttleMs);
				},
				error: (err) => {
					window?.unsubscribe();
					observer.error(err);
				},
				complete: () => {
					window?.unsubscribe();
					observer.complete();
				},
			});
			return () => {
				sub.unsubscribe();
				window?.unsubscribe();
			};
		});
}
