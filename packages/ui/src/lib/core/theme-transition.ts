import { z } from "zod";

/**
 * The light ↔ dark switch animation, shared by the apps (via `useThemeToggle`) and the
 * docs site. The new theme grows as a circle from the control that switched it, out to
 * the farthest viewport corner, using the View Transitions API. The browser snapshots
 * the old page, `applyTheme` repaints the new one, and only the reveal animates.
 *
 * Browsers without View Transitions, and anyone who prefers reduced motion, get the
 * instant switch: `applyTheme` runs directly and nothing animates.
 */

/** How long the reveal takes, in ms — long enough to read as a sweep, short enough not to wait on. */
export const THEME_TRANSITION_DURATION_MS = 520;
/** The shared emphasized-decelerate curve (`--ease-overlay-emphasized`); WAAPI needs it spelled out. */
export const THEME_TRANSITION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
/** The pseudo-element holding the new theme's snapshot. */
const NEW_SNAPSHOT_PSEUDO_ELEMENT = "::view-transition-new(root)";
/** Where the reveal starts when no control is on screen (a hotkey or the command palette): the top-right corner, where the shells keep their toggle. */
export const THEME_TRANSITION_FALLBACK_INSET_PX = 32;
/** Half of an element's size — its centre. */
const HALF = 2;

const VIEW_TRANSITION_DOCUMENT_SCHEMA = z.object({ startViewTransition: z.function() });

/** A viewport point (CSS px) the reveal grows from. */
export interface ThemeTransitionOrigin {
	readonly x: number;
	readonly y: number;
}

/** `true` when this browser can run the reveal (the View Transitions API exists). */
export function supportsThemeTransition(): boolean {
	return VIEW_TRANSITION_DOCUMENT_SCHEMA.safeParse(document).success;
}

/** `true` when the person asked their OS for less motion. */
export function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The centre of `element`, or the top-right corner when there is no element on screen to start from (absent, or hidden at this breakpoint). */
export function themeTransitionOrigin(element: Element | null): ThemeTransitionOrigin {
	const rect = element?.getBoundingClientRect();
	if (rect === undefined || rect.width === 0 || rect.height === 0) {
		return { x: window.innerWidth - THEME_TRANSITION_FALLBACK_INSET_PX, y: THEME_TRANSITION_FALLBACK_INSET_PX };
	}
	return { x: rect.left + rect.width / HALF, y: rect.top + rect.height / HALF };
}

/** The radius that covers the whole viewport from `origin` (distance to the farthest corner). */
export function themeTransitionRadius(origin: ThemeTransitionOrigin): number {
	return Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
}

/**
 * Runs `applyTheme` — which must change the theme on the DOM synchronously — inside a
 * circular reveal growing from `origin`; or runs it directly when the reveal is not
 * available or not wanted.
 */
export function runThemeTransition(applyTheme: () => void, origin: ThemeTransitionOrigin): void {
	if (!supportsThemeTransition() || prefersReducedMotion()) {
		applyTheme();
		return;
	}
	const root = document.documentElement;
	// Scopes the "no default cross-fade" CSS (styles/base.css) to this transition only.
	root.dataset.themeTransition = "";
	const transition = document.startViewTransition(applyTheme);
	const radius = themeTransitionRadius(origin);
	const clearScope = (): void => {
		delete root.dataset.themeTransition;
	};
	transition.finished.then(clearScope, clearScope);
	transition.ready
		.then((): void => {
			root.animate(
				{ clipPath: [`circle(0px at ${String(origin.x)}px ${String(origin.y)}px)`, `circle(${String(radius)}px at ${String(origin.x)}px ${String(origin.y)}px)`] },
				{ duration: THEME_TRANSITION_DURATION_MS, easing: THEME_TRANSITION_EASING, pseudoElement: NEW_SNAPSHOT_PSEUDO_ELEMENT },
			);
		})
		.catch((): void => {
			// `ready` rejects only when the browser skips the transition (e.g. the tab was
			// hidden); the theme is already applied by then, so there is nothing to undo.
		});
}
