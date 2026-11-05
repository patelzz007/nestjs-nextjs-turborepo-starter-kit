import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";
import { VFile } from "vfile";

import { rehypeHeadingIds } from "../heading-ids";

function heading(tagName: string, text: string, id?: string): Element {
	return { type: "element", tagName, properties: id === undefined ? {} : { id }, children: [{ type: "text", value: text }] };
}

function run(children: Element[]): { readonly tree: Root; readonly file: VFile } {
	const tree: Root = { type: "root", children };
	const file = new VFile();
	rehypeHeadingIds()(tree, file);
	return { tree, file };
}

describe("rehypeHeadingIds", () => {
	it("should slug each heading the way GitHub does and record it in document order", () => {
		const { tree, file } = run([heading("h2", "The words, in one line each"), heading("h3", "Backend (NestJS, `apps/api`)")]);
		expect(tree.children.map((node) => (node.type === "element" ? node.properties.id : null))).toEqual(["the-words-in-one-line-each", "backend-nestjs-appsapi"]);
		expect(file.data.headings).toEqual([
			{ depth: 2, slug: "the-words-in-one-line-each", text: "The words, in one line each" },
			{ depth: 3, slug: "backend-nestjs-appsapi", text: "Backend (NestJS, `apps/api`)" },
		]);
	});

	it("should de-duplicate repeated headings with a numeric suffix", () => {
		const { file } = run([heading("h2", "Setup"), heading("h2", "Setup")]);
		expect(file.data.headings?.map((item) => item.slug)).toEqual(["setup", "setup-1"]);
	});

	it("should keep an id the heading already has and ignore elements that are not headings", () => {
		const { file } = run([heading("h2", "Anything", "custom-id"), heading("p", "Not a heading"), heading("h7", "Not a heading either")]);
		expect(file.data.headings).toEqual([{ depth: 2, slug: "custom-id", text: "Anything" }]);
	});
});
