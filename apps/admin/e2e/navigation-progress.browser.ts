// The top progress bar in a real browser: a link click to another page shows it
// while the App Router waits on the server, and it clears once the page arrives.
// The page requests are held until the bar is seen, so the test does not depend
// on how fast the seeded API answers. Also checks the code block's look: One Dark
// Pro's background and the JetBrains Mono face.

import { expect, test, type Page } from "@playwright/test";

/** One Dark Pro's editor background, #282c34, as the browser reports it. */
const ONE_DARK_PRO_BACKGROUND = "rgb(40, 44, 52)";

/** React marks every DOM node it has hydrated with a key that starts with this. */
const REACT_FIBER_KEY_PREFIX = "__reactFiber$";

/** Before hydration the browser follows a link itself (a full page load, no App Router navigation): wait it out. */
async function expectHydrated(page: Page, selector: string): Promise<void> {
	await expect
		.poll((): Promise<boolean> =>
			page
				.locator(selector)
				.first()
				.evaluate((element: Element, prefix: string): boolean => Object.keys(element).some((key: string): boolean => key.startsWith(prefix)), REACT_FIBER_KEY_PREFIX),
		)
		.toBe(true);
}

/** Holds the App Router's page requests (the `rsc` header marks them) until the returned function is called. */
async function holdPageRequests(page: Page): Promise<() => void> {
	let release: () => void = (): void => undefined;
	const released = new Promise<void>((resolve): void => {
		release = resolve;
	});
	await page.route("**/*", async (route): Promise<void> => {
		if (route.request().headers().rsc === undefined) {
			await route.fallback();
			return;
		}
		await released;
		await route.fallback();
	});
	return release;
}

test("a slow link navigation shows the top progress bar until the page arrives", async ({ page }) => {
	// Hold page requests from the start: a production build prefetches the link as soon as it is on screen, and a
	// prefetched page arrives too fast for the bar to show at all.
	const release = await holdPageRequests(page);
	await page.goto("/components");
	const bar = page.locator('[data-slot="navigation-progress"]');
	await expect(bar).toHaveAttribute("data-phase", "idle");
	const linkSelector = 'main a[href="/components/code-block"]';
	const link = page.locator(linkSelector).first();
	await expect(link).toBeVisible();
	await expectHydrated(page, linkSelector);
	await link.click();
	await expect(bar).toHaveAttribute("data-phase", "loading");
	release();
	await expect(page).toHaveURL(/\/components\/code-block$/u);
	await expect(bar).toHaveAttribute("data-phase", "idle");
});

test("code blocks are drawn in One Dark Pro and set in JetBrains Mono", async ({ page }) => {
	await page.goto("/components/code-block");
	const code = page.locator('[data-slot="code-block"] pre').first();
	await expect(code).toBeVisible();
	// The highlighter loads lazily: wait for a highlighted word before measuring it.
	await expect(code.locator('[data-slot="code-block-token"]').first()).toBeAttached();
	const style = await code.evaluate((element: Element): { readonly codeFace: string; readonly fontFamily: string; readonly background: string } => {
		const block = element.closest('[data-slot="code-block"]') ?? element;
		return {
			codeFace: getComputedStyle(document.documentElement).getPropertyValue("--font-code"),
			fontFamily:
				element.querySelector('[data-slot="code-block-token"]') === null
					? "no highlighted token"
					: getComputedStyle(element.querySelector('[data-slot="code-block-token"]') ?? element).fontFamily, // a token span: the text a reader sees
			background: getComputedStyle(block).backgroundColor,
		};
	});
	expect(style.codeFace).toMatch(/jetBrainsMono/iu);
	expect(style.fontFamily).toMatch(/^"?jetBrainsMono"?,/u);
	expect(style.background).toBe(ONE_DARK_PRO_BACKGROUND);
});
