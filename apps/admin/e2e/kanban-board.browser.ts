// The kanban boards in a real browser: a card dragged with the pointer lands in
// another column and stays there after a reload (the move reached the API); the
// Planning / Execution and Board / List / Table switches live in the URL; and an
// item's page shows where it sits in the hierarchy and how far it has got. The
// card is dragged back afterwards, so the seeded board keeps its order.

import { expect, test, type Page } from "@playwright/test";

const BOARD_PATH = "/components/kanban-board";
/** A seeded story near the top of the execution board's "To Do", so it is on screen without scrolling its column. */
const CARD = "Download the tenant archive";
/** The seeded story right above it. */
const CARD_ABOVE = "POS terminal health page";
/** Pointer steps of one drag: the kit's mouse sensor starts after a few pixels of movement. */
const DRAG_STEPS = 25;

test.use({ viewport: { width: 1600, height: 1000 } });

/**
 * Drags the card titled `title` by its footer, drops it at (`x`, `y`), and waits
 * until the API has saved the move — the board shows the drop at once, before
 * the API answers, so a reload any sooner could read the board from before it.
 */
async function dragCard(page: Page, title: string, x: number, y: number): Promise<void> {
	const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/move"));
	const card = await page
		.getByRole("article")
		.filter({ has: page.getByRole("link", { name: title, exact: true }) })
		.boundingBox();
	if (card === null) {
		throw new Error(`The card "${title}" is not on screen`);
	}
	const startX = card.x + 40;
	const startY = card.y + card.height - 20;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	for (let step = 1; step <= DRAG_STEPS; step += 1) {
		await page.mouse.move(startX + ((x - startX) * step) / DRAG_STEPS, startY + ((y - startY) * step) / DRAG_STEPS);
	}
	await page.mouse.up();
	await saved;
}

async function boxOf(page: Page, name: string): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }> {
	const box = await page.getByRole("region", { name }).boundingBox();
	if (box === null) {
		throw new Error(`The column "${name}" is not on screen`);
	}
	return box;
}

test.beforeEach(async ({ page }) => {
	await page.goto(BOARD_PATH);
	await expect(page.getByRole("region", { name: "To Do" }).getByRole("link", { name: CARD, exact: true })).toBeVisible();
});

test("a dragged card moves to another column and stays there after a reload", async ({ page }) => {
	const review = await boxOf(page, "Review");
	await dragCard(page, CARD, review.x + review.width / 2, review.y + 120);
	await expect(page.getByRole("region", { name: "Review" }).getByRole("link", { name: CARD, exact: true })).toBeVisible();

	await page.reload();
	await expect(page.getByRole("region", { name: "Review" }).getByRole("link", { name: CARD, exact: true })).toBeVisible();

	// Back below the card it started under.
	const above = await page
		.getByRole("article")
		.filter({ has: page.getByRole("link", { name: CARD_ABOVE, exact: true }) })
		.boundingBox();
	if (above === null) {
		throw new Error(`The card "${CARD_ABOVE}" is not on screen`);
	}
	await dragCard(page, CARD, above.x + above.width / 2, above.y + above.height + 40);
	await page.reload();
	await expect(page.getByRole("region", { name: "To Do" }).getByRole("link", { name: CARD, exact: true })).toBeVisible();
});

test("the view switch is kept in the URL", async ({ page }) => {
	await page.getByRole("tab", { name: "Table" }).click();
	await expect(page).toHaveURL(/view=table/);
	await expect(page.getByRole("columnheader", { name: "Priority" })).toBeVisible();

	await page.reload();
	await expect(page.getByRole("tab", { name: "Table" })).toHaveAttribute("aria-selected", "true");
});

test("the board switch is kept in the URL and shows the planning board's epics and features", async ({ page }) => {
	await page.getByRole("tab", { name: "Planning" }).click();
	await expect(page).toHaveURL(/board=planning/);
	await expect(page.getByRole("region", { name: "Backlog" }).getByRole("link", { name: "Merchant growth", exact: true })).toBeVisible();

	await page.reload();
	await expect(page.getByRole("tab", { name: "Planning" })).toHaveAttribute("aria-selected", "true");
});

test("an item's page shows its place in the hierarchy, its progress and its history", async ({ page }) => {
	await page.getByRole("region", { name: "To Do" }).getByRole("link", { name: CARD }).click();

	await expect(page.getByRole("heading", { name: CARD })).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Hierarchy" }).getByRole("link", { name: /Tenant data export/ })).toBeVisible();
	await expect(page.getByText("Tasks done")).toBeVisible();
	await expect(page.getByRole("link", { name: "Archive worker in the job queue" })).toBeVisible();
	// The history is folded under its own heading until it is opened.
	await page.getByRole("button", { name: "History" }).click();
	await expect(page.getByText(/created this in To Do/)).toBeVisible();

	await page.getByRole("link", { name: "Edit story" }).click();
	await expect(page.getByRole("heading", { name: `Edit ${CARD}` })).toBeVisible();
	await expect(page.getByText("Acceptance criteria", { exact: true })).toBeVisible();
});
