"use client";

import * as React from "react";

/** How far outside the viewport an element counts as "near" — enough to start loading before it scrolls in. */
export const NEAR_VIEWPORT_MARGIN = "200px";

/**
 * Whether `element` has come within {@link NEAR_VIEWPORT_MARGIN} of the
 * viewport. Once true it stays true (work started for a near element is
 * never undone). `eager` skips the wait — for content that is above the fold.
 * Where `IntersectionObserver` does not exist, everything counts as near.
 */
export function useNearViewport(element: Element | null, eager = false): boolean {
	const [isNear, setIsNear] = React.useState(false);

	React.useEffect((): (() => void) | undefined => {
		if (eager || isNear || element === null || !("IntersectionObserver" in window)) {
			return undefined;
		}
		const observer = new IntersectionObserver(
			(entries: readonly IntersectionObserverEntry[]): void => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setIsNear(true);
					observer.disconnect();
				}
			},
			{ rootMargin: NEAR_VIEWPORT_MARGIN },
		);
		observer.observe(element);
		return (): void => {
			observer.disconnect();
		};
	}, [eager, element, isNear]);

	return eager || isNear || (element !== null && !("IntersectionObserver" in window));
}
