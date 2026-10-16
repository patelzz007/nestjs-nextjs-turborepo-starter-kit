// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAROUSEL_EXAMPLES } from "@/components/component-gallery/examples/carousel";
import { CAROUSEL_AUTOPLAY_DELAY_MS, Carousel5Example } from "@/components/component-gallery/examples/carousel/carousel-5";
import { Carousel11Example } from "@/components/component-gallery/examples/carousel/carousel-11";
import { Carousel9Example } from "@/components/component-gallery/examples/carousel/carousel-9";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine: Embla observes sizes and visibility, and reads
// each slide's offset box to work out its scroll snaps. Every box is one
// fixed size here, and each slide sits one box to the right of the previous
// one — so the carousels have real, distinct snaps to move between.

/** The width and height of every element's offset box, in pixels. */
const BOX_SIZE_PX = 100;
const ORIGIN_PX = 0;
/** Autoplay steps from the first of the Autoplay example's five slides to its last. */
const ADVANCES_TO_LAST_SLIDE = 4;
/** The first step, checked on its own. */
const FIRST_ADVANCE = 1;
const LAYOUT_PROPERTIES: readonly string[] = ["offsetWidth", "offsetHeight", "offsetLeft", "offsetTop"];

class NoopObserver {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
	public takeRecords(): readonly IntersectionObserverEntry[] {
		return [];
	}
}

function boxSize(): number {
	return BOX_SIZE_PX;
}

function origin(): number {
	return ORIGIN_PX;
}

/** A slide's left edge: its position among the track's slides, one box apart. */
function slideOffsetLeft(this: HTMLElement): number {
	const track = this.parentElement;
	if (this.dataset.slot !== "carousel-item" || track === null) return ORIGIN_PX;
	return [...track.children].indexOf(this) * BOX_SIZE_PX;
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", NoopObserver);
	vi.stubGlobal("IntersectionObserver", NoopObserver);
	Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: boxSize });
	Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: boxSize });
	Object.defineProperty(HTMLElement.prototype, "offsetLeft", { configurable: true, get: slideOffsetLeft });
	Object.defineProperty(HTMLElement.prototype, "offsetTop", { configurable: true, get: origin });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	for (const property of LAYOUT_PROPERTIES) {
		Reflect.deleteProperty(HTMLElement.prototype, property);
	}
});

/** Lets the kit hand Embla's api to `setApi` (it does so on the next tick). */
async function flushCarouselApi(): Promise<void> {
	await act(async (): Promise<void> => {
		await new Promise<void>((resolve: () => void): void => {
			setTimeout(resolve, ORIGIN_PX);
		});
	});
}

describe("Carousel examples", () => {
	it.each(CAROUSEL_EXAMPLES.map((example: GalleryExample): [string, GalleryExample] => [example.id, example]))(
		"renders %s with its slides",
		(_id: string, example: GalleryExample) => {
			render(<example.component />, { wrapper: UiKitTestProviders });

			expect(screen.getAllByRole("region").length).toBeGreaterThan(0);
			expect(screen.getAllByRole("img", { name: "Slide 1" }).length).toBeGreaterThan(0);
		},
	);

	it("dots navigation moves to the picked slide and marks its dot current", async () => {
		render(<Carousel11Example />, { wrapper: UiKitTestProviders });
		await flushCarouselApi();
		const third = screen.getByRole("button", { name: "Go to slide 3" });
		expect(third.getAttribute("aria-current")).toBe("false");

		fireEvent.click(third);

		expect(third.getAttribute("aria-current")).toBe("true");
		expect(screen.getByRole("button", { name: "Go to slide 1" }).getAttribute("aria-current")).toBe("false");
	});

	it("thumbnail strip shows the picked thumbnail's slide", async () => {
		render(<Carousel9Example />, { wrapper: UiKitTestProviders });
		await flushCarouselApi();

		fireEvent.click(screen.getByRole("button", { name: "Show slide 4" }));

		expect(screen.getByRole("button", { name: "Show slide 4" }).getAttribute("aria-current")).toBe("true");
		expect(screen.getByRole("button", { name: "Show slide 1" }).getAttribute("aria-current")).toBe("false");
	});

	it("autoplay advances on its delay and wraps back to the first slide after the last", () => {
		vi.useFakeTimers();
		render(<Carousel5Example />, { wrapper: UiKitTestProviders });
		act(() => {
			vi.advanceTimersByTime(ORIGIN_PX);
		});
		const carousel = screen.getByRole("region");
		const previous = within(carousel).getByRole("button", { name: "Previous slide" });
		const next = within(carousel).getByRole("button", { name: "Next slide" });
		expect(previous.hasAttribute("disabled")).toBe(true);

		act(() => {
			vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_DELAY_MS);
		});
		expect(previous.hasAttribute("disabled")).toBe(false);

		// The remaining advances reach the last slide; the next one wraps around.
		act(() => {
			vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_DELAY_MS * (ADVANCES_TO_LAST_SLIDE - FIRST_ADVANCE));
		});
		expect(next.hasAttribute("disabled")).toBe(true);
		act(() => {
			vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_DELAY_MS);
		});
		expect(previous.hasAttribute("disabled")).toBe(true);
		expect(next.hasAttribute("disabled")).toBe(false);
	});
});
