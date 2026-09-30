// ============================================
// apps/admin/vitest.setup.ts
// Runs before every vitest test file.
//
// `IS_REACT_ACT_ENVIRONMENT` tells React that a test renderer (here jsdom via
// @testing-library/react) is active. Without it, every `act(...)` call emits
// the "The current testing environment is not configured to support act(...)"
// stderr noise — tests still pass, but real async bugs get masked by the wall
// of warnings. Setting it once here silences that noise app-wide.
// ============================================

// React 19 reads this global to decide whether `act()` may run. jsdom tests
// in this repo use @testing-library/react, which requires it. Declared on
// `globalThis` (with a `declare global`) because the global type isn't in the
// DOM lib — assigning a bare property would be an implicit-any error.
declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout engine: its `matchMedia` reports `matches: false` for
// every query, which flips viewport-gated components (e.g. the DataTable's
// desktop-vs-mobile render branch on `(min-width: 1024px)`) into their mobile
// variant and hides the desktop DOM the tests assert on. Install a
// query-aware stub unconditionally: the desktop breakpoint matches (jsdom's
// default viewport is 1024px wide), everything else (mobile widths,
// `prefers-reduced-motion`) stays `false` as before. Tests that need different
// behavior still override `window.matchMedia` themselves.
globalThis.matchMedia = (query: string): MediaQueryList => ({
	matches: query.includes("min-width: 1024px") && !query.includes("max-width"),
	media: query,
	onchange: null,
	addListener: (): void => undefined,
	removeListener: (): void => undefined,
	addEventListener: (): void => undefined,
	removeEventListener: (): void => undefined,
	dispatchEvent: (): boolean => false,
});

export {};
