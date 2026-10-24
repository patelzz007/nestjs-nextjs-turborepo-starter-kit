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

/**
 * A `MediaQueryList` that matches only the desktop breakpoint. A real `EventTarget`, so
 * `addEventListener` / `removeEventListener` behave; it never fires `change` (the viewport never
 * changes under jsdom). The legacy `addListener` / `removeListener` are part of the interface and
 * do nothing.
 */
class DesktopMediaQueryList extends EventTarget implements MediaQueryList {
	public readonly matches: boolean;
	public readonly media: string;
	public onchange: MediaQueryList["onchange"] = null;

	public constructor(query: string) {
		super();
		this.matches = query.includes(DESKTOP_QUERY) && !query.includes("max-width");
		this.media = query;
	}

	public addListener(): void {
		// Legacy API: nothing ever changes, so there is nothing to notify.
	}

	public removeListener(): void {
		// Legacy API: see addListener.
	}
}

/** A `MediaQueryList` for `query`, matching only the desktop breakpoint. */
export function desktopMediaQueryList(query: string): MediaQueryList {
	return new DesktopMediaQueryList(query);
}

/** Installs {@link desktopMediaQueryList} as the global `matchMedia`. */
export function installDesktopMatchMedia(): void {
	globalThis.matchMedia = desktopMediaQueryList;
}
