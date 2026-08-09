// ============================================================
// hooks/use-stop-pointer-events.ts
//
// Shared event handlers for pointer-assisted affordances that live
// *inside* another interactive element (e.g. a clear button or a chip
// remove inside a Select trigger `<button>`).
//
// Two problems it solves:
//   1. The parent's onClick would fire (toggling the popup) — so the
//      click handler stops propagation AND prevents the default.
//   2. The parent's onPointerDown would steal focus — so the pointer
//      down handler stops propagation too.
//
// Used by `SelectClear` and `SelectChip` in components/select.tsx —
// both previously duplicated this pair of `useCallback`s.
// ============================================================

import * as React from "react";
import { useCallback } from "react";

/** The event handlers returned by `useStopPointerEvents`. */
export interface StopPointerEventsHandlers {
	/** Stops pointer-down propagation so the parent never steals focus. */
	readonly handlePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
	/** Stops + prevents the click default, then runs `onActivate`. */
	readonly handleClick: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Returns stable pointer-down / click handlers that contain an event before it
 * reaches an interactive parent (trigger buttons, rows, etc.).
 *
 * @param onActivate The action to run on click — always owned by the smart
 *   component (rules 9/10). Pass a stable callback when possible.
 */
export function useStopPointerEvents(onActivate: () => void): StopPointerEventsHandlers {
	const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>): void => {
		event.stopPropagation();
	}, []);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			onActivate();
		},
		[onActivate],
	);

	return { handlePointerDown, handleClick };
}
