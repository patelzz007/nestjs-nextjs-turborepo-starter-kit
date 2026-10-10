// How a swipe moves the drawer: pure functions of the finger's travel, so the
// gesture's rules are tested without simulating touches. Progress runs from 0
// (closed) to 1 (open).

const CLOSED = 0;
const OPEN = 1;
/** Released past halfway, the drawer finishes the move it was making. */
const HALFWAY = 0.5;
/** A flick faster than this (points per millisecond) decides the direction on its own. */
const FLING_VELOCITY = 0.5;

function clampProgress(progress: number): number {
	return Math.min(OPEN, Math.max(CLOSED, progress));
}

/** Dragging from the screen edge: the panel follows the finger in. */
export function progressWhileOpening(dx: number, panelWidth: number): number {
	return clampProgress(dx / panelWidth);
}

/** Dragging the open panel: the panel follows the finger out. */
export function progressWhileClosing(dx: number, panelWidth: number): number {
	return clampProgress(OPEN + dx / panelWidth);
}

/** Where a released drawer settles: a flick wins, otherwise whichever side of halfway it is on. */
export function settlesOpen(progress: number, velocityX: number): boolean {
	if (velocityX > FLING_VELOCITY) {
		return true;
	}
	if (velocityX < -FLING_VELOCITY) {
		return false;
	}
	return progress >= HALFWAY;
}

/** Minimum travel, in points, before a touch counts as a horizontal drag rather than a tap or a scroll. */
const DRAG_SLOP = 8;

/** A mostly horizontal move in the given direction (`1` rightwards, `-1` leftwards). */
export function isHorizontalDrag(dx: number, dy: number, direction: 1 | -1): boolean {
	return dx * direction > DRAG_SLOP && Math.abs(dx) > Math.abs(dy);
}
