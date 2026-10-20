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

import { installDesktopMatchMedia } from "@workspace/ui/testing/desktop-match-media";

// React 19 reads this global to decide whether `act()` may run. jsdom tests
// in this repo use @testing-library/react, which requires it. Declared on
// `globalThis` (with a `declare global`) because the global type isn't in the
// DOM lib — assigning a bare property would be an implicit-any error.
declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no `matchMedia` that knows the desktop breakpoint: install the kit's shared stub (desktop
// matches, everything else does not). Tests that need other behavior override `window.matchMedia`.
installDesktopMatchMedia();

export {};
