"use client";

import * as React from "react";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Focuses `targetRef` when `key` is pressed on its own (no modifier, not
 * repeated) while the member is not typing somewhere else — e.g. `/` to jump
 * to a search box.
 */
export function useFocusShortcut(targetRef: React.RefObject<HTMLElement | null>, key: string): void {
	React.useEffect((): (() => void) => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key !== key) {
				return;
			}
			if (isTypingTarget(event.target)) {
				return;
			}
			event.preventDefault();
			targetRef.current?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [key, targetRef]);
}
