import { describe, expect, it } from "vitest";

import { coverThumbnail } from "../cover-thumbnail";

describe("coverThumbnail", () => {
	it("should ask a resizing host for the card's size, keeping the image", () => {
		const url = new URL(coverThumbnail("https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1600&q=80", 640, 360));
		expect(url.pathname).toBe("/photo-1");
		expect(Object.fromEntries(url.searchParams)).toEqual({ auto: "format", fit: "crop", w: "640", h: "360", q: "70" });
	});

	it("should leave other hosts and unparseable values alone", () => {
		expect(coverThumbnail("https://example.com/cover.png", 640, 360)).toBe("https://example.com/cover.png");
		expect(coverThumbnail("/images/cover.png", 640, 360)).toBe("/images/cover.png");
	});
});
