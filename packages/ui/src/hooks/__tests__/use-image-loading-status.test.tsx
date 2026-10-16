// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useImageLoadingStatus } from "./use-image-loading-status";

/** Every detached image the hook creates, so a test can finish its load. */
const images: HTMLImageElement[] = [];
const NativeImage = window.Image;

beforeEach((): void => {
	images.length = 0;
	window.Image = class extends NativeImage {
		public constructor() {
			super();
			images.push(this);
		}
	};
});

afterEach((): void => {
	cleanup();
	window.Image = NativeImage;
});

function latestImage(): HTMLImageElement {
	const image = images.at(-1);
	if (image === undefined) {
		throw new Error("no image was created");
	}
	return image;
}

describe("useImageLoadingStatus", () => {
	it("is idle without a source and creates no image", () => {
		const { result } = renderHook(() => useImageLoadingStatus(null));

		expect(result.current).toBe("idle");
		expect(images).toHaveLength(0);
	});

	it("reports loading until the image loads, then loaded", () => {
		const { result } = renderHook(() => useImageLoadingStatus("https://cdn.example.com/a.webp"));
		expect(result.current).toBe("loading");
		expect(latestImage().getAttribute("src")).toBe("https://cdn.example.com/a.webp");

		act((): void => {
			latestImage().dispatchEvent(new Event("load"));
		});
		expect(result.current).toBe("loaded");
	});

	it("reports an image that fails as error", () => {
		const { result } = renderHook(() => useImageLoadingStatus("https://cdn.example.com/broken.webp"));

		act((): void => {
			latestImage().dispatchEvent(new Event("error"));
		});
		expect(result.current).toBe("error");
	});

	it("starts over for a new source and ignores the old image once replaced", () => {
		const { result, rerender } = renderHook(({ src }: { readonly src: string }) => useImageLoadingStatus(src), { initialProps: { src: "https://cdn.example.com/a.webp" } });
		const first = latestImage();
		act((): void => {
			first.dispatchEvent(new Event("load"));
		});

		rerender({ src: "https://cdn.example.com/b.webp" });
		expect(result.current).toBe("loading");

		const removed = vi.spyOn(first, "dispatchEvent");
		act((): void => {
			first.dispatchEvent(new Event("error"));
		});
		expect(removed).toHaveBeenCalled();
		expect(result.current).toBe("loading");
	});

	it("gives the detached copy the element's srcset and sizes, so it fetches the same rendition — not the full-size src too", () => {
		renderHook(() => useImageLoadingStatus("https://cdn.example.com/a/uhd.webp", true, { srcSet: "https://cdn.example.com/a/640.webp 640w", sizes: "50vw" }));

		const image = latestImage();
		expect(image.getAttribute("srcset")).toBe("https://cdn.example.com/a/640.webp 640w");
		expect(image.getAttribute("sizes")).toBe("50vw");
		expect(image.getAttribute("src")).toBe("https://cdn.example.com/a/uhd.webp");
	});

	it("starts over when the renditions change, even if src stays the same", () => {
		const { result, rerender } = renderHook(({ srcSet }: { readonly srcSet: string }) => useImageLoadingStatus("https://cdn.example.com/a/uhd.webp", true, { srcSet }), {
			initialProps: { srcSet: "https://cdn.example.com/a/640.webp 640w" },
		});
		act((): void => {
			latestImage().dispatchEvent(new Event("load"));
		});
		expect(result.current).toBe("loaded");

		rerender({ srcSet: "https://cdn.example.com/b/640.webp 640w" });
		expect(result.current).toBe("loading");
	});
});
