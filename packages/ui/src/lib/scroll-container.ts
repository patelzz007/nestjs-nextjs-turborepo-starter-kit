/**
 * Finds the element that actually scrolls the page content. The admin shell
 * scrolls inside `<main>` (overflow-y-auto), NOT the window, so a plain
 * `window` scroll listener never fires. Walking up from a known child finds
 * the first `overflow-y: auto|scroll|overlay` ancestor. Falls back to `window`
 * (the web app has no shell and scrolls the window).
 *
 * Shared by the docs ToC, the scroll-to-top button, and any other component
 * that needs to listen to the real page scroller.
 */
export function findPageScrollContainer(from: HTMLElement | null): Window | HTMLElement {
	let current: HTMLElement | null = from;
	while (current !== null) {
		const overflowY = getComputedStyle(current).overflowY;
		if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
			return current;
		}
		current = current.parentElement;
	}
	return window;
}
