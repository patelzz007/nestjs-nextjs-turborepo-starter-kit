"use client";

import * as React from "react";

/**
 * Generic `matchMedia` hook — returns whether `query` currently matches and
 * stays in sync with viewport changes. Components that need a specific
 * breakpoint (e.g. `lg` for the sidebar) use this instead of hand-rolling a
 * resize listener.
 *
 * Hydration-safe by design: the initial state is `false` on BOTH the server
 * and the first client render (reading `window.matchMedia` synchronously in
 * `useState` would return different values — `false` vs the real match — and
 * trigger a React hydration mismatch now that the shell is server-rendered).
 * The real value is resolved in an effect right after hydration.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = React.useState<boolean>(false);

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
