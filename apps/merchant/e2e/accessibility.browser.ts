// The merchant app's main store pages in a real browser (enhancement 3.3, with 3.2's check): each opens for
// the signed-in owner, and has no serious or critical accessibility problems (colour contrast included).

import { expect, test } from "@playwright/test";
import { pageAccessibilityViolations } from "@workspace/ui/testing/axe-page";

import { storePath } from "./sign-in.e2e";

const STORE_PAGES: readonly string[] = ["/dashboard", "/rewards", "/redemptions", "/payments", "/broadcasts", "/stores", "/analytics", "/api-keys", "/webhooks"];

for (const path of STORE_PAGES) {
	test(`${path} opens and has no serious accessibility problems`, async ({ page }) => {
		const response = await page.goto(storePath(path));
		expect(response?.ok(), path).toBe(true);
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		expect(await pageAccessibilityViolations(page), path).toStrictEqual([]);
	});
}
