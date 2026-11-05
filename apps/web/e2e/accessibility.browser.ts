// Every page the web browser suites visit, plus the public status page, checked with axe-core in a real browser
// (enhancement 3.2): no serious or critical accessibility problems, colour contrast and landmarks included.

import { expect, test, type Page } from "@playwright/test";
import { pageAccessibilityViolations } from "@workspace/ui/testing/axe-page";

/** A development-seed member with a verified email (apps/api/prisma/seed/users.ts). */
const MEMBER_EMAIL = "frank.miller@example.com";
const MEMBER_PASSWORD = "Frank@123";

const PUBLIC_PAGES: readonly string[] = ["/", "/auth/login", "/auth/signup", "/status"];
const SIGNED_IN_PAGES: readonly string[] = ["/dashboard", "/dashboard/account", "/dashboard/notifications"];

async function expectAccessible(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
	expect(await pageAccessibilityViolations(page), path).toStrictEqual([]);
}

test("the public pages have no serious accessibility problems", async ({ page }) => {
	for (const path of PUBLIC_PAGES) {
		await expectAccessible(page, path);
	}
});

test("the signed-in pages have no serious accessibility problems", async ({ page }) => {
	await page.goto("/auth/login?redirect=/dashboard");
	await page.getByLabel("Email").fill(MEMBER_EMAIL);
	await page.getByLabel("Password", { exact: true }).fill(MEMBER_PASSWORD);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL((url: URL) => url.pathname === "/dashboard");
	for (const path of SIGNED_IN_PAGES) {
		await expectAccessible(page, path);
	}
});
