"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * DocKeyboardNav — silent keyboard shortcuts while reading a guide:
 *
 * - `[` — previous guide (if any)
 * - `]` — next guide (if any)
 *
 * Guards: never fires while typing in an input/textarea/contenteditable, or
 * when a modifier key is held. The shortcut is documented in the ToC footer.
 */
export interface DocKeyboardNavProps {
	readonly prevHref?: string;
	readonly nextHref?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function DocKeyboardNav({ prevHref, nextHref }: DocKeyboardNavProps): null {
	const router = useRouter();

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			if (isTypingTarget(event.target)) {
				return;
			}
			if (event.key === "[") {
				event.preventDefault();
				if (prevHref !== undefined) {
					router.push(prevHref);
				}
			} else if (event.key === "]") {
				event.preventDefault();
				if (nextHref !== undefined) {
					router.push(nextHref);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [prevHref, nextHref, router]);

	return null;
}
