// The users table keeps its search, status filter and page in the URL. Proves,
// in a real browser, that debounced typing REPLACES the history entry, that a
// discrete change PUSHES one, and that Back/Forward restore the table from the
// URL — all without a document load.

import { BrowserHistoryProbe } from "@workspace/client/lib/url-state/browser-history-probe";
import { expect, test } from "@playwright/test";

import { adminBrowserE2eEnv } from "./browser-env.e2e";

test.beforeEach(async ({ page }) => {
	await page.goto("/auth/login?redirect=/users");
	await page.getByLabel("Email").fill(adminBrowserE2eEnv.ADMIN_E2E_EMAIL);
	await page.getByLabel("Password", { exact: true }).fill(adminBrowserE2eEnv.ADMIN_E2E_PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL((url: URL) => url.pathname === "/users");
});

test("typing replaces the entry, a filter pushes one, and Back/Forward restore the table", async ({ page }) => {
	const history = new BrowserHistoryProbe(page);
	await history.start();
	const search = page.getByRole("textbox", { name: "Search rows" });

	// Debounced typing commits with replaceState: the search lands in the URL, the history stack does not grow.
	await history.expectUrlWrite(
		"replace",
		() => search.fill("example"),
		(params) => params.get("search") === "example",
	);

	// A discrete change (the status filter) pushes an entry and resets to page 1.
	await history.expectUrlWrite(
		"push",
		async () => {
			await page.getByRole("combobox", { name: "Account status" }).click();
			await page.getByRole("option", { name: "Active", exact: true }).click();
		},
		(params) => params.get("filter[status]") === "active" && params.get("search") === "example",
	);

	// Back: the filter comes off, the typed search stays — both read back from the URL.
	await history.traverse(-1, (params) => !params.has("filter[status]") && params.get("search") === "example");
	await expect(search).toHaveValue("example");

	// Forward: the filter is restored.
	await history.traverse(1, (params) => params.get("filter[status]") === "active");
	await expect(search).toHaveValue("example");
});
