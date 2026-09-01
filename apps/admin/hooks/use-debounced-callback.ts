"use client";

import * as React from "react";

/**
 * Returns a stable callback that delays invocation until `delayMs` after the
 * last call.  The returned callback is referentially stable — safe for effect
 * deps and memoised props.  If the component unmounts, the pending call is
 * cancelled.
 */
export function useDebouncedCallback<T extends readonly unknown[]>(callback: (...args: T) => void, delayMs: number): (...args: T) => void {
	const callbackRef = React.useRef(callback);
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	// Keep callbackRef fresh without causing re-renders.
	React.useEffect((): void => {
		callbackRef.current = callback;
	}, [callback]);

	// Cancel pending call on unmount.
	React.useEffect((): (() => void) => {
		return (): void => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return React.useCallback(
		(...args: T): void => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout((): void => {
				timeoutRef.current = null;
				callbackRef.current(...args);
			}, delayMs);
		},
		[delayMs],
	);
}
