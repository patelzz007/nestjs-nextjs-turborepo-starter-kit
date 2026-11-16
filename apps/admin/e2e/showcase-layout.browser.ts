// The showcase's docs page in a real browser: a numbered code block scrolling under the pinned
// search stays beneath it (the block isolates its own layers), and the docs outline sticks a
// gap below the search instead of under it.

import { expect, test } from "@playwright/test";

/** Wide enough for the docs page's outline column (`xl:`). */
const WIDE_VIEWPORT = { width: 1600, height: 900 };
/** A point inside a code block's line-number gutter, from its left edge. */
const GUTTER_INSET_PX = 12;
/** How far into a numbered code block (past its header row) to line up with the search bar. */
const PAST_HEADER_SCROLL_PX = 60;
/** The gap the docs outline keeps below the pinned search (`--spacing(6)`). */
const OUTLINE_GAP_PX = 24;

test("on a docs page, numbered code scrolls under the pinned search, and the outline sticks clear below it", async ({ page }) => {
	await page.setViewportSize(WIDE_VIEWPORT);
	await page.goto("/components/number-field/docs");
	await expect(page.locator("aside nav")).toBeVisible();
	// Scroll the page until an example's numbered lines (below its header row) sit under the search bar.
	const numbered = page.locator("[data-showcase-docs-example] [data-code-line-numbers]").first();
	await expect(numbered).toBeVisible();
	await numbered.evaluate((element: Element, pastHeader: number): void => {
		const bar = document.querySelector('[data-slot="showcase-search"]');
		// The page's scroller: the first ancestor outside the code block that scrolls vertically.
		let scroller = element.closest("[data-showcase-docs-example]")?.parentElement ?? null;
		while (scroller !== null && !(/(auto|scroll)/u.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight))
			scroller = scroller.parentElement;
		if (bar === null || scroller === null) throw new Error("No search bar or page scroller.");
		const barBox = bar.getBoundingClientRect();
		scroller.scrollBy(0, element.getBoundingClientRect().top + pastHeader - (barBox.top + barBox.height / 2));
	}, PAST_HEADER_SCROLL_PX);
	const geometry = await page.evaluate((inset: number): { readonly searchBottom: number; readonly outlineTop: number; readonly onTopAtGutter: string } => {
		const bar = document.querySelector('[data-slot="showcase-search"]');
		const outline = document.querySelector("aside nav");
		const code = document.querySelector("[data-showcase-docs-example] [data-code-line-numbers]");
		if (bar === null || outline === null || code === null) throw new Error("The docs page is missing its search, outline or numbered code.");
		const barBox = bar.getBoundingClientRect();
		// The number cells ignore the pointer, which hit testing skips; let them answer so it reports what is painted on top.
		const probe = document.createElement("style");
		probe.textContent = "[data-slot=code-block] *::before { pointer-events: auto !important; }";
		document.head.append(probe);
		const hit = document.elementFromPoint(code.getBoundingClientRect().left + inset, barBox.top + barBox.height / 2);
		return {
			searchBottom: barBox.bottom,
			outlineTop: outline.getBoundingClientRect().top,
			onTopAtGutter: hit?.closest('[data-slot="showcase-search"]') ? "search" : "code",
		};
	}, GUTTER_INSET_PX);
	expect(geometry.onTopAtGutter).toBe("search");
	expect(geometry.outlineTop - geometry.searchBottom).toBeGreaterThanOrEqual(OUTLINE_GAP_PX);
});
