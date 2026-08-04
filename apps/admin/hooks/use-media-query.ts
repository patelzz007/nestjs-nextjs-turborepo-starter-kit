"use client";

import * as React from "react";

/**
 * Generic `matchMedia` hook — returns whether `query` currently matches and
 * stays in sync with viewport changes. Components that need a specific
 * breakpoint (e.g. `lg` for the sidebar) use this instead of hand-rolling a
 * resize listener.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = React.useState<boolean>(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return window.matchMedia(query).matches;
	});

	React.useEffect(() => {
		const mql = window.matchMedia(query);
		const onChange = (): void => {
			setMatches(mql.matches);
		};
		onChange();
		mql.addEventListener("change", onChange);
		return (): void => {
			mql.removeEventListener("change", onChange);
		};
	}, [query]);

	return matches;
}
