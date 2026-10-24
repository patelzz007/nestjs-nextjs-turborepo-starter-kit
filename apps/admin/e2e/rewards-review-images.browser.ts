// The moderation queue lists each reward compactly; "View more" opens the
// reward's page, which shows its photos as one swipeable carousel — never
// stacked one under another — opens them full size in a carousel dialog on the
// photo the page shows, downloads the shown photo's original upload, and all of
// them at once as one ZIP. Proves what jsdom cannot: real navigation, the
// slides' real layout, Embla's scrolling and real downloads.

import { readFile } from "node:fs/promises";

import { expect, test, type Download, type Locator } from "@playwright/test";
import { LIST_SLOT_INDEX } from "@workspace/shared";

/** The development seed's pending reward (apps/api/prisma/seed/rewards.ts), shown with the three `weekend-brunch` photos. */
const PENDING_REWARD_TITLE = "20% off weekend brunch";

test.beforeEach(async ({ page }) => {
	await page.goto("/rewards/review");
	// The queue row is compact: it opens the reward's own page.
	const row = page.getByRole("article", { name: PENDING_REWARD_TITLE });
	await expect(row.locator('[data-slot="image-carousel"]')).toHaveCount(0);
	await row.getByRole("link", { name: `View more about ${PENDING_REWARD_TITLE}` }).click();
	await page.waitForURL((url: URL) => url.pathname.startsWith("/rewards/review/"));
	await expect(page.getByRole("heading", { level: 1, name: PENDING_REWARD_TITLE })).toBeVisible();
});

/** Every ZIP starts with a local file header: `PK\x03\x04`. */
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

async function savedBytes(download: Download): Promise<Buffer> {
	return readFile(await download.path());
}

async function boxOf(locator: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number }> {
	const box = await locator.boundingBox();
	if (box === null) {
		throw new Error("The element is not rendered");
	}
	return box;
}

test("lays the photos out as one carousel, keeps the shown photo in the full-size view, and downloads it", async ({ page }) => {
	// The page's own carousel; the viewer's renders in a portal, outside the main content.
	const carousel = page.locator('#main-content [data-slot="image-carousel"]');
	const slides = carousel.getByRole("group");
	await expect(slides).toHaveCount(3);

	// Side by side on one row, each as wide as the carousel: a carousel, not a column of photos.
	const [first, second] = await Promise.all([boxOf(slides.nth(LIST_SLOT_INDEX.first)), boxOf(slides.nth(LIST_SLOT_INDEX.second))]);
	const frame = await boxOf(carousel);
	expect(second.y).toBe(first.y);
	expect(second.x - first.x).toBeCloseTo(frame.width, 0);
	await expect(page.getByText("3 photos, 3840 × 2160 pixels")).toBeVisible();

	await carousel.getByRole("button", { name: "Next slide" }).click();
	await expect(carousel.getByText("2 / 3")).toBeVisible();

	// The viewer opens on the photo the page shows, and moves on its own.
	await page.getByRole("button", { name: `View the photos of ${PENDING_REWARD_TITLE} full size` }).click();
	const viewer = page.getByRole("dialog", { name: PENDING_REWARD_TITLE });
	await expect(viewer.getByText("Photo 2 of 3, uploaded at 3840 × 2160 pixels.")).toBeVisible();
	await viewer.getByRole("button", { name: "Next slide" }).click();
	await expect(viewer.getByText("Photo 3 of 3, uploaded at 3840 × 2160 pixels.")).toBeVisible();

	// The shown photo's original upload, saved under its file name.
	const downloadPromise = page.waitForEvent("download");
	await viewer.getByRole("button", { name: `Download photo 3 of 3 of ${PENDING_REWARD_TITLE}` }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe("weekend-brunch-03.webp");
	expect(await download.failure()).toBeNull();

	// Closing the viewer leaves the page on the photo it was left on.
	await page.keyboard.press("Escape");
	await expect(viewer).toBeHidden();
	await expect(carousel.getByText("3 / 3")).toBeVisible();
});

test("downloads every photo of the reward at once as one ZIP", async ({ page }) => {
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: `Download all 3 photos of ${PENDING_REWARD_TITLE} as a ZIP file` }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe("20-off-weekend-brunch-photos.zip");
	expect(await download.failure()).toBeNull();
	const bytes = await savedBytes(download);
	expect(bytes.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)).toBe(true);
	// Three 4K originals, stored as they are.
	expect(bytes.byteLength).toBeGreaterThan(3 * 100_000);
});
