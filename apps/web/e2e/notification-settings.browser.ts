// A member's notification settings in a real browser (enhancement 3.4): a change is saved at once and is still
// there after a reload. The test puts the setting back, so it can run again on the same database.

import { expect, test, type Page } from "@playwright/test";

/** A development-seed member with a verified email (apps/api/prisma/seed/users.ts). */
const MEMBER_EMAIL = "frank.miller@example.com";
const MEMBER_PASSWORD = "Frank@123";
const SETTINGS_PATH = "/dashboard/notifications/settings";

async function quietHours(page: Page): Promise<boolean> {
	const toggle = page.getByRole("switch", { name: "Quiet hours" });
	await expect(toggle).toBeEnabled();
	return (await toggle.getAttribute("aria-checked")) === "true";
}

async function flipQuietHours(page: Page): Promise<void> {
	await page.getByRole("switch", { name: "Quiet hours" }).click();
	await expect(page.getByText("Saved").first()).toBeVisible();
}

test("turning quiet hours on or off is saved and survives a reload", async ({ page }) => {
	await page.goto(`/auth/login?redirect=${SETTINGS_PATH}`);
	await page.getByLabel("Email").fill(MEMBER_EMAIL);
	await page.getByLabel("Password", { exact: true }).fill(MEMBER_PASSWORD);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL((url: URL) => url.pathname === SETTINGS_PATH);
	await expect(page.getByRole("heading", { name: "Notification settings" })).toBeVisible();

	const before = await quietHours(page);
	await flipQuietHours(page);
	await page.reload();
	await expect.poll(() => quietHours(page)).toBe(!before);

	// Put it back as it was.
	await flipQuietHours(page);
	await page.reload();
	await expect.poll(() => quietHours(page)).toBe(before);
});
