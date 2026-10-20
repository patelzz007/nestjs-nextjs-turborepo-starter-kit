// A member's own profile picture on the account settings page, in a real
// browser: a photo that is not square opens the crop dialog; zoomed all the way
// out it keeps the whole photo; "Use photo" crops it in the browser (canvas),
// uploads it through the file pipeline (the API re-checks the pixels), and the
// new picture shows. Removing it brings the initials back.

import { expect, test, type Page } from "@playwright/test";

/** A development-seed member with a verified email, so the session is full (apps/api/prisma/seed/users.ts). */
const MEMBER_EMAIL = "frank.miller@example.com";
const MEMBER_PASSWORD = "Frank@123";

/** A portrait photo, drawn on a canvas in the page — taller than square, so it needs the crop step. */
async function portraitPhoto(page: Page): Promise<Buffer> {
	const dataUrl = await page.evaluate((): string => {
		const canvas = document.createElement("canvas");
		canvas.width = 600;
		canvas.height = 900;
		const context = canvas.getContext("2d");
		if (context === null) {
			throw new Error("No 2D canvas");
		}
		["#d9480f", "#2b8a3e", "#1971c2"].forEach((colour, band) => {
			context.fillStyle = colour;
			context.fillRect(0, band * 300, 600, 300);
		});
		return canvas.toDataURL("image/png");
	});
	const [, base64 = ""] = dataUrl.split(",");
	return Buffer.from(base64, "base64");
}

test("crops a portrait photo to a square profile picture, uploads it, and removes it again", async ({ page }) => {
	await page.goto("/auth/login?redirect=/dashboard/account");
	await page.getByLabel("Email").fill(MEMBER_EMAIL);
	await page.getByLabel("Password", { exact: true }).fill(MEMBER_PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL((url: URL) => url.pathname === "/dashboard/account");

	await page.locator('input[type="file"]').setInputFiles({ name: "stripes.png", mimeType: "image/png", buffer: await portraitPhoto(page) });

	const dialog = page.getByRole("dialog", { name: "Crop your profile picture" });
	await expect(dialog).toBeVisible();
	// All the way out: the whole photo shows, over a blurred copy of itself.
	await dialog.getByRole("slider").first().focus();
	await page.keyboard.press("Home");
	await expect(dialog.locator('[data-slot="image-cropper-backdrop"]')).toBeVisible();
	await dialog.getByRole("button", { name: "Use photo" }).click();

	await expect(page.getByText("Profile picture updated")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible();

	await page.getByRole("button", { name: "Remove" }).click();
	await expect(page.getByText("Profile picture removed")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
});
