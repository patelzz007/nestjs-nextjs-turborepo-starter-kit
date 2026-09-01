import { type Observable } from "rxjs";
import * as React from "react";

/**
 * `useObservable(source, initialValue)` — the React binding for RxJS
 * observables, built on React's own `useSyncExternalStore` rather than a
 * hand-rolled store.
 *
 * Renders `initialValue` on the server AND on the first client render (so SSR
 * output never hydration-mismatches), then live-updates with each emission.
 *
 * Unsubscribe guarantee: the subscription created here is unsubscribed when
 * the component unmounts (or `source` identity changes) — no leaked timers,
 * listeners, or fetch pipelines across re-renders or navigations.
 *
 * Design notes:
 * - The latest value lives in a ref; `getSnapshot` reads the ref. A source
 *   that emits synchronously on subscribe (BehaviorSubject, `of`) triggers
 *   `onStoreChange` DURING `subscribe` — React re-reads the snapshot, sees the
 *   new value, and re-renders exactly once (no loop: the next snapshot equals
 *   the post-subscribe one).
 * - A stream that errors with no error handler is reported by the Subscriber's
 *   unhandled-error path — errors stay loud instead of being swallowed.
 * - A stream that completes keeps its last value rendered (like `take(1)`-ish
 *   stores); the subscription is already closed, so the registry stays clean.
 */
export function useObservable<T>(source: Observable<T>, initialValue: T): T {
	const latestValueRef = React.useRef<T>(initialValue);

	const subscribe = React.useCallback(
		(onStoreChange: () => void): (() => void) => {
			const subscription = source.subscribe({
				next: (value) => {
					latestValueRef.current = value;
					onStoreChange();
				},
			});
			return (): void => {
				subscription.unsubscribe();
			};
		},
		[source],
	);

	const getSnapshot = React.useCallback((): T => latestValueRef.current, []);
	const getServerSnapshot = React.useCallback((): T => initialValue, [initialValue]);

	return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
