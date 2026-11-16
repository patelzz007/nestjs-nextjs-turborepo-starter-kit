import { describe, expect, it } from "vitest";

import { pickImageRendition } from "../image-sources";

const IMAGE = {
	url: "https://cdn.example.com/original.jpg",
	sources: [
		{ width: 256, url: "https://cdn.example.com/256.jpg" },
		{ width: 64, url: "https://cdn.example.com/64.jpg" },
		{ width: 128, url: "https://cdn.example.com/128.jpg" },
	],
};

describe("pickImageRendition", () => {
	it("picks the smallest rendition that is sharp at the drawn size", () => {
		expect(pickImageRendition(IMAGE, 60)).toBe("https://cdn.example.com/64.jpg");
		expect(pickImageRendition(IMAGE, 120)).toBe("https://cdn.example.com/128.jpg");
		expect(pickImageRendition(IMAGE, 128)).toBe("https://cdn.example.com/128.jpg");
	});

	it("falls back to the largest rendition, then to the image's own URL", () => {
		expect(pickImageRendition(IMAGE, 1024)).toBe("https://cdn.example.com/256.jpg");
		expect(pickImageRendition({ url: IMAGE.url }, 40)).toBe(IMAGE.url);
		expect(pickImageRendition({ url: IMAGE.url, sources: [] }, 40)).toBe(IMAGE.url);
	});
});
