// Visual regression for the UI kit (enhancement 3.8): every component page of the admin component gallery
// (`/components/<slug>`, in catalog order), in light and in dark, compared pixel by pixel with its committed
// screenshot. A change to a kit component, a token or a theme that moves any pixel fails here and shows the
// difference; an intended change is accepted by updating the screenshots (`pnpm test:visual:update`, which
// renders them in Playwright's Linux image, the renderer CI runs). Signed in as the super admin.
// That update rewrites only the screenshots that fail, and a pixel fails only past Playwright's colour tolerance:
// a subtle theme change (the admin's dark theme moving to graphite, 2026-11-05) passes on most pages and leaves the
// old colours committed. After a deliberate theme change, rewrite that theme's screenshots outright:
// `node ../../packages/tooling/src/playwright-in-docker/cli.ts ADMIN_E2E_ --forward 3001 --forward 8080
// --forward 8025 --project=visual --grep "\(dark\)" --update-snapshots=all`.
//
// What keeps a screenshot the same from run to run: the page's own clock is Playwright's (`clock.install`),
// paused before the page loads (so a slow load never changes what the clock says) and moved on only after the
// fonts and images are in, so "today" is a fixed date and every timer- or frame-driven animation (progress loops,
// typing traces, carousels, a panel resizing to its content) is caught at the same moment; `Math.random` is
// seeded; every external image is a fixed stand-in (no network); the page settles in rounds until its height stops
// changing; reduced motion and no CSS animations or caret; and only the page's own article (not the sidebar or the
// header, which show the signed-in account).
// The suite outlives an access token, so each test starts from the session the one before it left
// (`signedInTest`): replaying the sign-in's rotated-out refresh token would sign the rest of the run out.
//
// What makes it show every example: the gallery mounts each one only as it nears the viewport, so the page's
// IntersectionObserver reports every element as on screen at once (the gallery's own unit tests do the same,
// family-demos.test.tsx); components that need the observer for themselves (carousels, the stepper, the message
// scroller) keep one. `content-visibility: auto` (which skips rendering what is off screen) is turned off. The
// panel scrolls inside its own container, which paints only what is in the viewport, so the viewport is made as
// tall as the article before the shot, with the panel scrolled back to its start.

import { expect, type Locator, type Page } from "@playwright/test";

import { GALLERY_CATALOG_ORDER } from "../components/component-gallery/gallery-catalog";
import { adminBrowserE2eEnv } from "./browser-env.e2e";
import { signedInTest as test } from "./sign-in.e2e";

/** The moment every demo believes it is: a weekday morning in the middle of a month. */
const FIXED_NOW = new Date("2026-03-11T09:30:00.000Z");

/** How long the page's (fake) clock runs after loading, and after the viewport grows: every demo's animation is over by then. */
const SETTLE_MS = 5000;

/**
 * How long one screenshot may take. The longest pages (the data grid's, over 20,000 px tall) take several seconds
 * to capture twice and compare; Playwright's 5 s default is for a viewport-sized shot.
 */
const SCREENSHOT_TIMEOUT_MS = 30_000;

/** One page: loading, two settles of the clock and the shot (the default 30 s leaves the longest shot no room). */
const TEST_TIMEOUT_MS = 90_000;

/** Where the clock is paused, before the page loads: just after the moment it was installed at. */
const PAUSE_AFTER_MS = 1000;

/** An IntersectionObserver that reports every observed element as fully on screen, as soon as it is observed. */
const ON_SCREEN_INTERSECTION_OBSERVER = `
window.IntersectionObserver = class OnScreenIntersectionObserver {
	constructor(callback) { this.callback = callback; this.root = null; this.rootMargin = "0px"; this.thresholds = [0]; }
	observe(target) {
		const bounds = target.getBoundingClientRect();
		this.callback([{ isIntersecting: true, intersectionRatio: 1, target, boundingClientRect: bounds, intersectionRect: bounds, rootBounds: null, time: 0 }], this);
	}
	unobserve() {}
	disconnect() {}
	takeRecords() { return []; }
};
`;

/**
 * Every element rendered, on screen or not. The gallery's example cards (and the message scroller's rows) use
 * `content-visibility: auto`, which skips rendering an element off screen and decides it is on screen only at a
 * later rendering step: right after the viewport grows, a card could keep its reserved height but be shot blank.
 */
const RENDER_EVERYTHING_STYLE = "*, *::before, *::after { content-visibility: visible !important; }";

/**
 * A seeded `Math.random` (mulberry32), installed before the page's own scripts: demos that move by random steps
 * (a progress loop, a shuffled pick) take the same steps on every run, as the paused clock gives them the same time.
 */
const SEEDED_RANDOM = `
(() => {
	let state = 0x2f6b3c1d;
	Math.random = () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
})();
`;

/** Where Next's image optimizer serves an image from (`next/image` in a card): it fetches the original itself. */
const NEXT_IMAGE_PATH = "/_next/image";

/** The size of the stand-in for an external image (3:2, a photo's shape); the page's CSS sizes it as it would the original. */
const STAND_IN_WIDTH_PX = 1200;
const STAND_IN_HEIGHT_PX = 800;

/** FNV-1a (32-bit): a stable number from a URL, so the same image gets the same stand-in on every run. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HUE_TURN_DEGREES = 360;

function urlHash(url: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const character of url) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
	}
	return hash;
}

/**
 * A fixed picture for an external image (Unsplash photos, GitHub avatars…): a flat colour from its URL. The gallery
 * shows hundreds of them; fetched for real, one slow or failed image (an avatar falling back to its initials) changed
 * a screenshot. The suite checks the kit's pixels, not the internet's.
 */
function standInImage(url: string): string {
	const hue = urlHash(url) % HUE_TURN_DEGREES;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(STAND_IN_WIDTH_PX)}" height="${String(STAND_IN_HEIGHT_PX)}"><rect width="100%" height="100%" fill="hsl(${String(hue)} 45% 55%)"/></svg>`;
}

/** The admin app the suite runs against: any other origin is outside it. */
const ADMIN_ORIGIN = new URL(adminBrowserE2eEnv.ADMIN_E2E_BASE_URL).origin;

/** Whether a request is an image from outside the admin app (directly, or through Next's optimizer). */
function isExternalImage(url: URL, origin: string): boolean {
	return url.origin !== origin || url.pathname === NEXT_IMAGE_PATH;
}

/** Room under the article once the viewport is grown to hold it, so nothing at its foot sits at the very edge. */
const VIEWPORT_MARGIN_PX = 64;

/**
 * Settle rounds at most: each waits for the network, the fonts and every image, runs the clock on, and grows the
 * viewport to the article; the page is still once a round leaves the article's height as it was. Two rounds settle
 * every gallery page today; the cap only stops a page that never stops growing (which then fails on its shot).
 */
const MAX_SETTLE_ROUNDS = 4;

/** The article's height after one settle round: network quiet, fonts and images in, the clock run on, the viewport grown to hold it. */
async function settleRound(page: Page, article: Locator): Promise<number> {
	await page.waitForLoadState("networkidle");
	await page.evaluate(async (): Promise<void> => {
		await document.fonts.ready;
		await Promise.all(
			Array.from(document.images, (image: HTMLImageElement): Promise<void> => {
				// A lazy image off screen (a carousel's later slides) never starts loading, so waiting on it would
				// never end: load it now, as the screenshot is meant to show every example in full.
				image.loading = "eager";
				return image.complete ? Promise.resolve() : image.decode().catch((): void => undefined);
			}),
		);
	});
	// Run the clock only after the fonts and images: the layout changes they cause (and the animations those
	// start) happen inside this run, never after it, frozen half-way by the paused clock.
	await page.clock.runFor(SETTLE_MS);
	// CSS transitions and animations run on real time, not the paused clock, so one can still be resizing the page
	// here. The shot ends them (`animations: "disabled"`: finite ones jump to their end, endless ones are cancelled);
	// ending them the same way now means the height measured is the height shot.
	await page.evaluate((): void => {
		for (const animation of document.getAnimations()) {
			if (animation.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY) {
				animation.cancel();
			} else {
				animation.finish();
			}
		}
	});
	// The article's foot with the page and every container around it scrolled back to their start. A demo can scroll
	// the panel (an input focused on mount, a message list scrolled to its end), leaving the article's top above the
	// viewport and its foot unpainted; only the containers around the article are reset, never one inside a demo.
	const bottom = await article.evaluate((element: HTMLElement): number => {
		for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
			parent.scrollTop = 0;
		}
		window.scrollTo(0, 0);
		return element.getBoundingClientRect().bottom;
	});
	const viewport = page.viewportSize();
	expect(viewport, "the page's viewport").not.toBeNull();
	if (viewport === null) {
		return 0;
	}
	const height = Math.ceil(bottom + VIEWPORT_MARGIN_PX);
	if (height !== viewport.height) {
		await page.setViewportSize({ width: viewport.width, height });
	}
	return height;
}

type ColorScheme = "light" | "dark";

const COLOR_SCHEMES: readonly ColorScheme[] = ["light", "dark"];

for (const { entry } of GALLERY_CATALOG_ORDER) {
	for (const colorScheme of COLOR_SCHEMES) {
		test(`${entry.slug} (${colorScheme})`, async ({ page }) => {
			test.setTimeout(TEST_TIMEOUT_MS);
			await page.clock.install({ time: FIXED_NOW });
			await page.clock.pauseAt(new Date(FIXED_NOW.getTime() + PAUSE_AFTER_MS));
			await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
			await page.addInitScript({ content: ON_SCREEN_INTERSECTION_OBSERVER });
			await page.addInitScript({ content: SEEDED_RANDOM });
			await page.route(
				(url: URL): boolean => isExternalImage(url, ADMIN_ORIGIN),
				async (route): Promise<void> => {
					if (route.request().resourceType() !== "image") {
						await route.continue();
						return;
					}
					await route.fulfill({ status: 200, contentType: "image/svg+xml", body: standInImage(route.request().url()) });
				},
			);
			await page.goto(`/components/${entry.slug}`);
			await page.addStyleTag({ content: RENDER_EVERYTHING_STYLE });
			const article = page.locator("article[aria-labelledby='component-page-title']");
			let height = await settleRound(page, article);
			for (let round = 1; round < MAX_SETTLE_ROUNDS; round += 1) {
				const next = await settleRound(page, article);
				if (next === height) {
					break;
				}
				height = next;
			}
			// The browser paints only what is in the viewport: an article reaching past it would be shot with a blank foot.
			const box = await article.boundingBox();
			expect(box, "the component page's article").not.toBeNull();
			expect(box?.y, "the article's top is inside the viewport").toBeGreaterThanOrEqual(0);
			expect((box?.y ?? 0) + (box?.height ?? 0), "the article's foot is inside the viewport").toBeLessThanOrEqual(height);
			await expect(article).toHaveScreenshot(`${entry.slug}-${colorScheme}.png`, { animations: "disabled", caret: "hide", timeout: SCREENSHOT_TIMEOUT_MS });
		});
	}
}
