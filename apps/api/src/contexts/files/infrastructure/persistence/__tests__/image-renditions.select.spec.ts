import { describe, expect, it } from "vitest";

import { toImageSources } from "../image-renditions.select";
import { TEST_RESOLVE_PUBLIC_URL } from "../../../../../../test/support/public-urls";

describe("toImageSources", () => {
	it("serves every published rendition, in the order given (smallest first)", () => {
		expect(
			toImageSources(
				[
					{ width: 128, publicPath: "https://cdn.example.com/a/thumbnail.webp" },
					{ width: 512, publicPath: "https://cdn.example.com/a/large.webp" },
				],
				TEST_RESOLVE_PUBLIC_URL,
			),
		).toEqual([
			{ width: 128, url: "https://cdn.example.com/a/thumbnail.webp" },
			{ width: 512, url: "https://cdn.example.com/a/large.webp" },
		]);
	});

	it("leaves out a rendition without a width, without a public URL, or with a URL the contract rejects", () => {
		expect(
			toImageSources(
				[
					{ width: null, publicPath: "https://cdn.example.com/a/x.webp" },
					{ width: 256, publicPath: null },
					{ width: 256, publicPath: "javascript:alert(1)" },
					{ width: 256, publicPath: "https://cdn.example.com/a/medium.webp" },
				],
				TEST_RESOLVE_PUBLIC_URL,
			),
		).toEqual([{ width: 256, url: "https://cdn.example.com/a/medium.webp" }]);
	});

	it("is empty for an image without renditions", () => {
		expect(toImageSources([], TEST_RESOLVE_PUBLIC_URL)).toEqual([]);
	});
});
