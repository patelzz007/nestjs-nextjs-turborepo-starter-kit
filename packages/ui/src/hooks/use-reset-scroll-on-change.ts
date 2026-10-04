"use client";

import * as React from "react";

/**
 * Scrolls `containerRef` back to the top whenever `resetKey` changes (e.g.
 * the pathname). For a shell whose content scrolls inside its own container
 * rather than the window — the browser and the router only restore the
 * window's scroll, so without this a new page opens half-way down. Runs before
 * paint, so the previous page's offset never shows; the content itself is NOT
 * remounted, so page state (forms, open dialogs, query observers) survives.
 */
export function useResetScrollOnChange(containerRef: React.RefObject<HTMLElement | null>, resetKey: string | undefined): void {
	React.useLayoutEffect((): void => {
		const container = containerRef.current;
		if (resetKey === undefined || container === null) {
			return;
		}
		container.scrollTop = 0;
	}, [containerRef, resetKey]);
}
