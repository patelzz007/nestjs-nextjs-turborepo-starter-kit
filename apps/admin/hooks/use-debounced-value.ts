"use client";

import * as React from "react";

/** Returns a debounced copy of `value` that updates after `delayMs` of stability. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debouncedValue, setDebouncedValue] = React.useState(value);

	React.useEffect((): (() => void) => {
		const timer = setTimeout((): void => {
			setDebouncedValue(value);
		}, delayMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [value, delayMs]);

	return debouncedValue;
}
