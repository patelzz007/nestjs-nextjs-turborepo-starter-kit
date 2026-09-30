// ============================================
// apps/merchant/vitest.setup.ts
// Runs before every vitest test file (mirrors apps/admin/vitest.setup.ts).
// ============================================

// React 19 reads this global to decide whether `act()` may run; jsdom tests use
// @testing-library/react, which requires it.
declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
