// ============================================
// motion.ts — easing curves
// ============================================

import type { Motion } from "./schema";
import { cubicBezier } from "./value";

export const MOTION: Motion = {
	/* Overlay motion curves — popup/stack springs (drawer, navigation menu, toast). */
	"ease-overlay-emphasized": cubicBezier(0.22, 1, 0.36, 1),
	"ease-drawer-backdrop": cubicBezier(0.32, 0.72, 0, 1),
	"ease-drawer-content": cubicBezier(0.45, 1.005, 0, 1.005),
	/* Emphasized enter (decelerate) / exit (accelerate) — floating affordances like the message-scroller jump button. */
	"ease-emphasized-enter": cubicBezier(0.23, 1, 0.32, 1),
	"ease-emphasized-exit": cubicBezier(0.7, 0, 0.84, 0),
};
