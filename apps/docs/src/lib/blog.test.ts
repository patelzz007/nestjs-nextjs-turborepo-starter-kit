import { describe, expect, it } from "vitest";

import { BlogMetaSchema, orderPosts, postHref } from "./blog";

describe("orderPosts", () => {
	const posts = [
		{ id: "old", date: 1 },
		{ id: "listed-second", date: 5 },
		{ id: "new", date: 9 },
		{ id: "listed-first", date: 2 },
	];

	it("puts meta-listed posts first in meta order, then the rest newest first", () => {
		const meta = BlogMetaSchema.parse({ pages: ["listed-first", "listed-second"] });
		expect(orderPosts(meta, posts).map((post) => post.id)).toEqual(["listed-first", "listed-second", "new", "old"]);
	});

	it("builds post URLs", () => {
		expect(postHref("telescope")).toBe("/blog/telescope");
	});
});
