/** Class the sticky header gets once the page is scrolled (frosted background). */
export const SCROLLED_CLASS = "is-scrolled";

/**
 * Keeps the header transparent over the top-of-page glow and frosted once
 * content scrolls underneath it (the apidog behaviour).
 */
export function initHeader(): void {
	const header = document.querySelector<HTMLElement>(".site-header");
	if (header === null) {
		return;
	}
	const update = (): void => {
		header.classList.toggle(SCROLLED_CLASS, window.scrollY > 0);
	};
	let scheduled = false;
	window.addEventListener(
		"scroll",
		() => {
			if (scheduled) {
				return;
			}
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				update();
			});
		},
		{ passive: true },
	);
	update();
}
