// The desktop sidebar's open / collapse motion (`Sidebar`, off-canvas): one
// spring drives a single number — `--sidebar-progress`, 0 collapsed to 1 open —
// and the gap the sidebar reserves and the sidebar's slide are both computed
// from it in CSS (styles/components.css), so they can never drift apart and
// nothing else in the shell snaps while they move.

/** A spring's physical constants (framer-motion's `type: "spring"`). */
export interface SidebarSpring {
	readonly type: "spring";
	readonly stiffness: number;
	readonly damping: number;
	readonly mass: number;
}

/**
 * Soft, quick and settled: about a third of a second, and critically damped
 * (damping ratio ≥ 1), so the panel edge glides in and stops — it never
 * overshoots and wobbles back.
 */
export const SIDEBAR_SPRING: SidebarSpring = { type: "spring", stiffness: 320, damping: 38, mass: 1 };

/** Under "reduce motion", the sidebar is simply there or not. */
export const SIDEBAR_NO_MOTION = { duration: 0 };

/** The CSS custom property the spring animates (read by components.css). */
export const SIDEBAR_PROGRESS_PROPERTY = "--sidebar-progress";

/** The progress of an open and a collapsed sidebar. */
export const SIDEBAR_PROGRESS_OPEN = 1;
export const SIDEBAR_PROGRESS_COLLAPSED = 0;

/** The damping ratio ζ = c / (2√(k·m)): ≥ 1 means no overshoot. */
export function dampingRatioOf(spring: SidebarSpring): number {
	return spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
}
