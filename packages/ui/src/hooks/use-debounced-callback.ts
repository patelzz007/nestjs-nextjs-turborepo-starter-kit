"use client";

import * as React from "react";

/** Returns a stable callback that delays invocation until `delayMs` after the last call. */
export function useDebouncedCallback<T extends readonly unknown[]>(callback: (...args: T) => void, delayMs: number): (...args: T) => void {
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
