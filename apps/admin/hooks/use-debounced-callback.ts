"use client";

import * as React from "react";

/**
 * Returns a stable callback that delays invocation until `delayMs` after the
 * last call.  The returned callback is referentially stable — safe for effect
 * deps and memoised props.  If the component unmounts, the pending call is
 * cancelled.  Single-argument form (e.g. a state setter); the latest argument
 * wins.
 */
export function useDebouncedCallback<TArg>(callback: (arg: TArg) => void, delayMs: number): (arg: TArg) => void {
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
		(arg: TArg): void => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout((): void => {
				timeoutRef.current = null;
				callbackRef.current(arg);
			}, delayMs);
		},
		[delayMs],
	);
}
