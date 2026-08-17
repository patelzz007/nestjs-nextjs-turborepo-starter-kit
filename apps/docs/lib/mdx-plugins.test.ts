import { describe, expect, it } from "vitest";
import type { Root, Table, TableCell } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

import { detectQuoteKind, remarkImageGalleryPlugin, remarkImageRewritePlugin, remarkQuoteKindsPlugin, remarkStripFirstHeadingPlugin, QUOTE_MARKER_KINDS } from "./mdx-plugins";

/** Runs a plugin transformer over a synthetic mdast root. */
function runTransformer(root: Root, transformer: (tree: Root) => void): Root {
	transformer(root);
	return root;
}

function rootOf(children: Root["children"]): Root {
	return { type: "root", children };
}

/** Asserts the first root child is a JSX flow element with the given name and returns it. */
function expectJsxFlow(root: Root, name: string): MdxJsxFlowElement {
	const node = root.children[0];
	if (node?.type !== "mdxJsxFlowElement") {
		throw new Error(`expected mdxJsxFlowElement, got ${String(node?.type)}`);
	}
	expect(node.name).toBe(name);
	return node;
}

/** Reads one string attribute of a JSX element. */
function attrOf(node: MdxJsxFlowElement, name: string): string | undefined {
	const attr = node.attributes.find((candidate) => candidate.type === "mdxJsxAttribute" && candidate.name === name);
	return typeof attr?.value === "string" ? attr.value : undefined;
}

describe("quote kinds", () => {
	it("maps GitHub-style markers to kinds", () => {
		expect(QUOTE_MARKER_KINDS.note).toBe("info");
		expect(QUOTE_MARKER_KINDS.tip).toBe("tip");
		expect(QUOTE_MARKER_KINDS.success).toBe("success");
		expect(QUOTE_MARKER_KINDS.warning).toBe("warning");
		expect(QUOTE_MARKER_KINDS.caution).toBe("warning");
		expect(QUOTE_MARKER_KINDS.error).toBe("error");
	});

	it("detects kinds from keywords in plain quotes", () => {
		expect(detectQuoteKind("This failed to start")).toBe("error");
		expect(detectQuoteKind("Watch out, this wipes data")).toBe("warning");
		expect(detectQuoteKind("The migration succeeded")).toBe("success");
		expect(detectQuoteKind("A useful tip")).toBe("tip");
		expect(detectQuoteKind("Neutral prose")).toBe("info");
	});

	it("converts a [!WARNING] blockquote into a Callout and strips the marker", () => {
		const root = rootOf([
			{
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!WARNING] **Careful** watch the salt rounds" }],
					},
				],
			},
		]);
		runTransformer(root, remarkQuoteKindsPlugin());
		expect(attrOf(expectJsxFlow(root, "Callout"), "type")).toBe("warning");
	});

	it("drops a marker-only paragraph (canonical shape)", () => {
		const root = rootOf([
			{
				type: "blockquote",
				children: [
					{ type: "paragraph", children: [{ type: "text", value: "[!NOTE]" }] },
					{ type: "paragraph", children: [{ type: "text", value: "Body text" }] },
				],
			},
		]);
		runTransformer(root, remarkQuoteKindsPlugin());
		expect(expectJsxFlow(root, "Callout").children).toHaveLength(1);
	});
});

describe("remarkImageRewritePlugin", () => {
	it("rewrites repo-relative image urls to web-relative", () => {
		const root = rootOf([{ type: "image", url: "./images/email/verification.png", alt: "Verification", title: null }]);
		runTransformer(root, remarkImageRewritePlugin());
		const image = root.children[0];
		expect(image?.type).toBe("image");
		if (image?.type === "image") {
			expect(image.url).toBe("/images/email/verification.png");
		}
	});
});

describe("remarkImageGalleryPlugin", () => {
	function cellWithImage(src: string, alt: string): TableCell {
		return { type: "tableCell", children: [{ type: "image", url: src, alt, title: null }] };
	}

	function rowOf(cells: TableCell[]): Table["children"][number] {
		return { type: "tableRow", children: cells };
	}

	it("converts an image-bearing table into an ImageGallery", () => {
		const table: Table = {
			type: "table",
			align: [],
			children: [
				rowOf([
					{ type: "tableCell", children: [{ type: "text", value: "Template" }] },
					{ type: "tableCell", children: [{ type: "text", value: "Preview" }] },
				]),
				rowOf([{ type: "tableCell", children: [{ type: "text", value: "Email Verification" }] }, cellWithImage("/images/email/verification.png", "Email Verification")]),
				rowOf([{ type: "tableCell", children: [{ type: "text", value: "Welcome" }] }, cellWithImage("/images/email/welcome.png", "Welcome")]),
			],
		};
		const root = rootOf([table]);
		runTransformer(root, remarkImageGalleryPlugin());
		const itemsAttr = attrOf(expectJsxFlow(root, "ImageGallery"), "items");
		expect(itemsAttr).toContain("verification.png");
	});

	it("leaves a mixed table alone", () => {
		const table: Table = {
			type: "table",
			align: [],
			children: [rowOf([{ type: "tableCell", children: [{ type: "text", value: "A" }] }]), rowOf([{ type: "tableCell", children: [{ type: "text", value: "no image" }] }])],
		};
		const root = rootOf([table]);
		runTransformer(root, remarkImageGalleryPlugin());
		expect(root.children[0]?.type).toBe("table");
	});
});

describe("remarkStripFirstHeadingPlugin", () => {
	it("removes the leading h1 but keeps the rest", () => {
		const root = rootOf([
			{ type: "heading", depth: 1, children: [{ type: "text", value: "Title" }] },
			{ type: "heading", depth: 2, children: [{ type: "text", value: "Section" }] },
		]);
		runTransformer(root, remarkStripFirstHeadingPlugin());
		expect(root.children).toHaveLength(1);
		const remaining = root.children[0];
		expect(remaining?.type).toBe("heading");
		if (remaining?.type === "heading") {
			expect(remaining.depth).toBe(2);
		}
	});
});
