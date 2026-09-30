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

export {};
