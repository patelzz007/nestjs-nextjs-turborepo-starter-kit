// ============================================
// apps/web/vitest.setup.ts
// Runs before every vitest test file.
//
// React 19 reads `IS_REACT_ACT_ENVIRONMENT` to decide whether `act()` may run;
// jsdom component tests use @testing-library/react, which requires it.
// ============================================

import { installDesktopMatchMedia } from "@workspace/ui/testing/desktop-match-media";

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no `matchMedia` that knows the desktop breakpoint: install the kit's shared stub (desktop
// matches, everything else does not). Tests that need other behavior override `window.matchMedia`.
installDesktopMatchMedia();

export {};
