// ============================================
// testing/desktop-match-media.ts — the shared jsdom `matchMedia` stub
// ============================================
// jsdom has no layout engine: its `matchMedia` is missing or reports
// `matches: false` for every query, which flips viewport-gated components
// (the sidebar, the DataTable's desktop-vs-mobile branch, the breadcrumb's
// crumb budget) into their mobile variant. This stub is query-aware: the
// desktop breakpoint matches (jsdom's default viewport is 1024px wide),
// everything else (mobile widths, `prefers-reduced-motion`) is `false`.
// Every app's and package's test setup installs it; a test that needs other
// behavior overrides `window.matchMedia` itself.

/** The desktop breakpoint query the kit's viewport hooks use. */
const DESKTOP_QUERY = "min-width: 1024px";

/** A `MediaQueryList` for `query`, matching only the desktop breakpoint. */
export function desktopMediaQueryList(query: string): MediaQueryList {
	return {
		matches: query.includes(DESKTOP_QUERY) && !query.includes("max-width"),
		media: query,
		onchange: null,
		addListener: (): void => undefined,
		removeListener: (): void => undefined,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
		dispatchEvent: (): boolean => false,
	};
}

/** Installs {@link desktopMediaQueryList} as the global `matchMedia`. */
export function installDesktopMatchMedia(): void {
	globalThis.matchMedia = desktopMediaQueryList;
}
