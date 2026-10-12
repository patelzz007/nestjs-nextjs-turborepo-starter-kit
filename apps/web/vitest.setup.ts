// ============================================
// apps/web/vitest.setup.ts
// Runs before every vitest test file.
//
// React 19 reads `IS_REACT_ACT_ENVIRONMENT` to decide whether `act()` may run;
// jsdom component tests use @testing-library/react, which requires it.
// ============================================

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout engine and no `matchMedia`; the shared shell
// (`SidebarProvider`, viewport hooks) reads it. The same query-aware stub as
// apps/admin: the desktop breakpoint matches (jsdom's default viewport is
// 1024px wide), everything else (mobile widths, `prefers-reduced-motion`) is
// `false`. Tests that need different behavior override `window.matchMedia`.
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
