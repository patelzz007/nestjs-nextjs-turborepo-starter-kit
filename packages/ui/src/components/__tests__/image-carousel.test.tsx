// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { ImageCarousel, type ImageCarouselImage } from "../image-carousel";

/** Embla observes the viewport's size and its slides' visibility — jsdom implements neither. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopObserver);
	vi.stubGlobal("IntersectionObserver", NoopObserver);
	window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

afterEach((): void => {
	cleanup();
});

function photo(id: string): ImageCarouselImage {
	return { id, src: `https://cdn.example.com/${id}/uhd.webp`, sources: [{ width: 640, url: `https://cdn.example.com/${id}/thumbnail.webp` }] };
}

function images(): HTMLImageElement[] {
	return [...document.querySelectorAll<HTMLImageElement>('[data-slot="cover-image"] img')];
}

describe("ImageCarousel", () => {
	it("renders a single image as a plain cover — no carousel controls", () => {
		render(<ImageCarousel images={[photo("a")]} priority />, { wrapper: UiKitTestProviders });

		expect(document.querySelector('[data-slot="image-carousel"]')).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		expect(images().map((image) => image.getAttribute("loading"))).toEqual(["eager"]);
	});

	it("lays several images out as labelled slides with previous/next, a counter and a dot per image", () => {
		render(<ImageCarousel images={[photo("a"), photo("b"), photo("c")]} sizes="50vw" />, { wrapper: UiKitTestProviders });

		expect(document.querySelector('[data-slot="image-carousel"]')).not.toBeNull();
		expect(screen.getAllByRole("group").map((slide) => slide.getAttribute("aria-label"))).toEqual(["Image 1 of 3", "Image 2 of 3", "Image 3 of 3"]);
		expect(screen.getByRole("button", { name: "Next slide" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Previous slide" })).toBeDefined();
		expect(screen.getByText("1 / 3")).toBeDefined();
		expect(screen.getAllByRole("button", { name: /^Show image \d$/u })).toHaveLength(3);
		expect(screen.getByRole("button", { name: "Show image 1" }).getAttribute("aria-current")).toBe("true");
		expect(images().map((image) => image.getAttribute("sizes"))).toEqual(["50vw", "50vw", "50vw"]);
	});

	it("loads only the first slide eagerly, and only when asked to", () => {
		render(<ImageCarousel images={[photo("a"), photo("b")]} priority />, { wrapper: UiKitTestProviders });

		expect(images().map((image) => image.getAttribute("loading"))).toEqual(["eager", "lazy"]);
	});

	it("starts at the requested image, loading that one eagerly when asked to", () => {
		render(<ImageCarousel images={[photo("a"), photo("b"), photo("c")]} startIndex={2} priority />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("3 / 3")).toBeDefined();
		expect(screen.getByRole("button", { name: "Show image 3" }).getAttribute("aria-current")).toBe("true");
		expect(images().map((image) => image.getAttribute("loading"))).toEqual(["lazy", "lazy", "eager"]);
	});

	it("keeps an out-of-range start index on the last image", () => {
		render(<ImageCarousel images={[photo("a"), photo("b")]} startIndex={9} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("2 / 2")).toBeDefined();
	});

	it("renders nothing without images", () => {
		const { container } = render(<ImageCarousel images={[]} />, { wrapper: UiKitTestProviders });

		expect(container.innerHTML).toBe("");
	});
});
