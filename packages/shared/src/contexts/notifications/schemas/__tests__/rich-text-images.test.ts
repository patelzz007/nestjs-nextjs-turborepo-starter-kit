import { describe, expect, it } from "vitest";

import type { RichTextDocument } from "../rich-text";
import { imageFileIdsOf, withImageSources, withoutImageSources } from "../rich-text-images";

const TOP = "0190f0e0-0000-7000-8000-000000000001";
const IN_LIST = "0190f0e0-0000-7000-8000-000000000002";
const IN_QUOTE = "0190f0e0-0000-7000-8000-000000000003";

const DOCUMENT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "image", attrs: { fileId: TOP, alt: "Our new shop" } },
		{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "image", attrs: { fileId: IN_LIST, alt: "" } }] }] },
		{
			type: "blockquote",
			content: [
				{ type: "image", attrs: { fileId: IN_QUOTE, alt: "Quoted" } },
				{ type: "image", attrs: { fileId: TOP, alt: "Again" } },
			],
		},
		{ type: "paragraph", content: [{ type: "text", text: "Come and see." }] },
	],
};

describe("imageFileIdsOf", () => {
	it("finds every picture at any depth, each once, in order", () => {
		expect(imageFileIdsOf(DOCUMENT)).toStrictEqual([TOP, IN_LIST, IN_QUOTE]);
		expect(imageFileIdsOf({ type: "doc", content: [{ type: "paragraph" }] })).toStrictEqual([]);
	});
});

describe("withImageSources", () => {
	it("gives each known picture its address, and leaves an unknown one without", () => {
		const answered = withImageSources(
			DOCUMENT,
			new Map([
				[TOP, "https://cdn.example.com/top.webp"],
				[IN_LIST, "https://cdn.example.com/list.webp"],
			]),
		);
		expect(imageFileIdsOf(answered)).toStrictEqual([TOP, IN_LIST, IN_QUOTE]);
		expect(answered.content.at(0)).toStrictEqual({ type: "image", attrs: { fileId: TOP, alt: "Our new shop", src: "https://cdn.example.com/top.webp" } });
		// The quote holds an unknown picture (no address) and the top one again (its address).
		expect(answered.content.at(2)).toStrictEqual({
			type: "blockquote",
			content: [
				{ type: "image", attrs: { fileId: IN_QUOTE, alt: "Quoted" } },
				{ type: "image", attrs: { fileId: TOP, alt: "Again", src: "https://cdn.example.com/top.webp" } },
			],
		});
		expect(answered.content.at(3)).toStrictEqual(DOCUMENT.content.at(3));
	});

	it("drops a stale address the map no longer knows (a removed picture isn't shown)", () => {
		const stale: RichTextDocument = { type: "doc", content: [{ type: "image", attrs: { fileId: TOP, alt: "", src: "https://old.example.com/x.webp" } }] };
		expect(withImageSources(stale, new Map())).toStrictEqual({ type: "doc", content: [{ type: "image", attrs: { fileId: TOP, alt: "" } }] });
	});
});

describe("withoutImageSources", () => {
	it("names every picture by file id only again, at any depth, so an edited body can be saved", () => {
		const answered = withImageSources(
			DOCUMENT,
			new Map([
				[TOP, "https://cdn.example.com/top.webp"],
				[IN_LIST, "https://cdn.example.com/list.webp"],
				[IN_QUOTE, "https://cdn.example.com/q.webp"],
			]),
		);
		expect(withoutImageSources(answered)).toStrictEqual(DOCUMENT);
	});
});
