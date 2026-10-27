// The public catalog (`/`, `#rewards`) keeps its city and category filters in
// the URL. Proves, in a real browser, that a filter change is a client-side
// `pushState` that re-renders the catalog, and that Back/Forward restore the
// filters from the URL — without a document load.

import { BrowserHistoryProbe } from "@workspace/client/lib/url-state/browser-history-probe";
import { expect, test, type Locator, type Page } from "@playwright/test";

const CITY_PARAM = "filter[city]";
const CATEGORY_PARAM = "filter[category]";

function chip(page: Page, name: string): Locator {
	return page.getByRole("button", { name, exact: true });
}

test("filters are pushed to the URL and Back/Forward restore them without a reload", async ({ page }) => {
	await page.goto("/#rewards");
	await expect(chip(page, "All cities")).toHaveAttribute("aria-pressed", "true");
	const history = new BrowserHistoryProbe(page);
	await history.start();

	await history.expectUrlWrite(
		"push",
		() => chip(page, "Melaka").click(),
		(params) => params.get(CITY_PARAM) === "MELAKA",
	);
	await expect(chip(page, "Melaka")).toHaveAttribute("aria-pressed", "true");

	await history.expectUrlWrite(
		"push",
		() => chip(page, "cafe").click(),
		(params) => params.get(CITY_PARAM) === "MELAKA" && params.get(CATEGORY_PARAM) === "cafe",
	);
	await expect(chip(page, "cafe")).toHaveAttribute("aria-pressed", "true");

	// Back: the category comes off; the city stays — read back from the URL.
	await history.traverse(-1, (params) => params.get(CITY_PARAM) === "MELAKA" && !params.has(CATEGORY_PARAM));
	await expect(chip(page, "cafe")).toHaveAttribute("aria-pressed", "false");
	await expect(chip(page, "Melaka")).toHaveAttribute("aria-pressed", "true");

	// Back again: no filter at all.
	await history.traverse(-1, (params) => !params.has(CITY_PARAM) && !params.has(CATEGORY_PARAM));
	await expect(chip(page, "All cities")).toHaveAttribute("aria-pressed", "true");

	// Forward: the city filter is restored.
	await history.traverse(1, (params) => params.get(CITY_PARAM) === "MELAKA");
	await expect(chip(page, "Melaka")).toHaveAttribute("aria-pressed", "true");
});

test("a submitted search is pushed, and Back restores the previous search box text", async ({ page }) => {
	await page.goto("/#rewards");
	const history = new BrowserHistoryProbe(page);
	await history.start();
	const search = page.getByRole("textbox", { name: "Search rewards" });

	await history.expectUrlWrite(
		"push",
		async () => {
			await search.fill("coffee");
			await search.press("Enter");
		},
		(params) => params.get("search") === "coffee",
	);

	await history.traverse(-1, (params) => !params.has("search"));
	await expect(search).toHaveValue("");
});

// A Back pressed the moment the submitted search reaches the address bar, before React has
// rendered from it: the URL engine (nuqs) writes the URL on the tick after the submit, in a
// router transition, so this Back lands while that transition is still pending. The box must
// still follow the URL (useHistoryTraversalCount).
test("a Back pressed before the submitted search was committed still restores the search box text", async ({ page }) => {
	await page.goto("/#rewards");
	const history = new BrowserHistoryProbe(page);
	await history.start();
	const search = page.getByRole("textbox", { name: "Search rewards" });
	await search.fill("coffee");

	// Submit, then go back in the same task that sees the pushed URL — before React can commit it.
	await search.evaluate(async (input: HTMLInputElement): Promise<void> => {
		input.form?.requestSubmit();
		await new Promise<void>((resolve: () => void): void => {
			const backOnceWritten = (): void => {
				if (new URLSearchParams(window.location.search).get("search") === "coffee") {
					window.history.back();
					resolve();
					return;
				}
				setTimeout(backOnceWritten, 0);
			};
			backOnceWritten();
		});
	});

	await page.waitForFunction((): boolean => window.location.search === "");
	await expect(search).toHaveValue("");
	await history.expectSameDocument();
});
