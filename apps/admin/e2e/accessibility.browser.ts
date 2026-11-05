// Every page the admin browser suites visit, plus the operations screens added with enhancements 2.6 and 4.4–4.5,
// checked with axe-core in a real browser (enhancement 3.2): no serious or critical accessibility problems,
// colour contrast and landmarks included. Signed in as the super admin (sign-in.setup.ts).

import { expect, test } from "@playwright/test";
import { pageAccessibilityViolations } from "@workspace/ui/testing/axe-page";

const PAGES: readonly string[] = [
	"/",
	"/users",
	"/account/profile",
	"/rewards/review",
	"/operations/servers",
	"/operations/backups",
	"/operations/queues",
	"/operations/status",
	"/operations/status/new",
	"/audit-logs",
];

for (const path of PAGES) {
	test(`${path} has no serious accessibility problems`, async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState("networkidle");
		expect(await pageAccessibilityViolations(page), path).toStrictEqual([]);
	});
}
