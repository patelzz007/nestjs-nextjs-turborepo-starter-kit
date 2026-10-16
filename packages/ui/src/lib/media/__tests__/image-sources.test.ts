import { describe, expect, it } from "vitest";

import { fixedImageSizes, imageSrcSet } from "../image-sources";

describe("imageSrcSet", () => {
	it("lists the renditions smallest first, whatever order they came in", () => {
		expect(
			imageSrcSet([
				{ width: 512, url: "https://cdn.example.com/a/large.webp" },
				{ width: 128, url: "https://cdn.example.com/a/thumbnail.webp" },
			]),
		).toBe("https://cdn.example.com/a/thumbnail.webp 128w, https://cdn.example.com/a/large.webp 512w");
	});

	it("is undefined without renditions, so the image falls back to its own URL", () => {
		expect(imageSrcSet([])).toBeUndefined();
		expect(imageSrcSet(undefined)).toBeUndefined();
	});
});

describe("fixedImageSizes", () => {
	it("says the image is always drawn at a fixed width", () => {
		expect(fixedImageSizes(28)).toBe("28px");
	});
});
