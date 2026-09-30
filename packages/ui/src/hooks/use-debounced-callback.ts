"use client";

import * as React from "react";

/**
 * Returns a stable callback that delays invocation until `delayMs` after the last call.
 * The debounced callback forwards the most recent single argument (e.g. a state setter's value).
 */
export function useDebouncedCallback<TArg>(callback: (arg: TArg) => void, delayMs: number): (arg: TArg) => void {
	const callbackRef = React.useRef(callback);
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	React.useEffect((): void => {
		callbackRef.current = callback;
	}, [callback]);

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
