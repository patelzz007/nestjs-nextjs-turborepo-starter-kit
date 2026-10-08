"use client";

import { useEffect, useState } from "react";

/**
 * `value`, settled: it follows `value` only once `value` has stopped changing for
 * `delayMs`. Use it to drive something costly from fast input — a server-rendered
 * preview re-rendered as the person types — without a request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [settled, setSettled] = useState<T>(value);

	useEffect((): (() => void) => {
		const timer = window.setTimeout((): void => {
			setSettled(value);
		}, delayMs);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [value, delayMs]);

	return settled;
}
