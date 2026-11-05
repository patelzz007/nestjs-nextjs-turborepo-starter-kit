// The platform broadcasts pages in a real browser (enhancement 3.4): the list links to the composer, and the
// rich-text editor behaves as a writer expects (typing, bold on the selection, the preview following along).

import { expect, test } from "@playwright/test";

test("the list opens the composer, whose editor formats the selected words and fills the preview", async ({ page }) => {
	await page.goto("/emails/broadcasts");
	await expect(page.getByRole("heading", { name: "Broadcasts", level: 1 })).toBeVisible();
	await page.getByRole("link", { name: "New broadcast" }).click();
	await page.waitForURL((url: URL) => url.pathname === "/emails/broadcasts/new");
	await expect(page.getByRole("heading", { name: "New broadcast" })).toBeVisible();

	const message = page.getByRole("textbox", { name: "Message" });
	await message.click();
	await page.keyboard.type("Our new opening hours start on Monday.");
	await page.keyboard.press("Shift+Home");
	const bold = page.getByRole("button", { name: "Bold" });
	await bold.click();
	await expect(bold).toHaveAttribute("aria-pressed", "true");
	await expect(message.locator("strong")).toHaveText("Our new opening hours start on Monday.");
	await expect(page.getByRole("complementary", { name: "Preview" })).toContainText("Our new opening hours start on Monday.");
});
