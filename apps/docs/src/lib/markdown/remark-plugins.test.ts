import type { Blockquote, Root, RootContent, Table } from "mdast";
import { describe, expect, it } from "vitest";

import {
	detectQuoteKind,
	galleryHtml,
	QUOTE_MARKER_KINDS,
	remarkCallouts,
	remarkGlossary,
	remarkImageGallery,
	remarkImageUrls,
	remarkMermaid,
	remarkStripFirstHeading,
	remarkTaskMarkers,
	replaceTaskMarker,
	rewriteImageUrl,
	splitGlossaryTerms,
} from "./remark-plugins";

function rootOf(children: RootContent[]): Root {
	return { type: "root", children };
}

function run(root: Root, plugin: () => (tree: Root) => void): Root {
	plugin()(root);
	return root;
}

/** The leading entry of a node list; `undefined` when the list is empty or absent. */
function leading<T>(items: readonly T[] | undefined): T | undefined {
	const [first] = items ?? [];
	return first;
}

function firstChild(root: Root): RootContent {
	const node = leading(root.children);
	if (node === undefined) {
		throw new Error("expected a first child");
	}
	return node;
}

function quote(text: string): Blockquote {
	return { type: "blockquote", children: [{ type: "paragraph", children: [{ type: "text", value: text }] }] };
}

describe("callouts", () => {
	it("maps GitHub-style markers to kinds", () => {
		expect(QUOTE_MARKER_KINDS.note).toBe("info");
		expect(QUOTE_MARKER_KINDS.caution).toBe("warning");
		expect(QUOTE_MARKER_KINDS.danger).toBe("error");
	});

	it("detects kinds from keywords in plain quotes", () => {
		expect(detectQuoteKind("This failed to start")).toBe("error");
		expect(detectQuoteKind("Watch out, this wipes data")).toBe("warning");
		expect(detectQuoteKind("The migration succeeded")).toBe("success");
		expect(detectQuoteKind("A useful tip")).toBe("tip");
		expect(detectQuoteKind("Neutral prose")).toBe("info");
	});

	it("turns a [!WARNING] quote into an aside with a title and strips the marker", () => {
		const root = run(rootOf([quote("[!WARNING] Watch the salt rounds")]), remarkCallouts);
		const node = firstChild(root);
		expect(node.type).toBe("blockquote");
		expect(node.data).toEqual({ hName: "aside", hProperties: { className: ["callout"], "data-kind": "warning" } });
		if (node.type !== "blockquote") {
			throw new Error("expected blockquote");
		}
		const [title, body] = node.children;
		expect(title?.type === "paragraph" ? leading(title.children) : undefined).toEqual({ type: "text", value: "Warning" });
		expect(body?.type === "paragraph" ? leading(body.children) : undefined).toEqual({ type: "text", value: "Watch the salt rounds" });
	});

	it("drops a marker-only paragraph", () => {
		const root = rootOf([
			{
				type: "blockquote",
				children: [
					{ type: "paragraph", children: [{ type: "text", value: "[!NOTE]" }] },
					{ type: "paragraph", children: [{ type: "text", value: "Body" }] },
				],
			},
		]);
		run(root, remarkCallouts);
		const node = firstChild(root);
		expect(node.type === "blockquote" ? node.children.length : 0).toBe(2);
	});

	it("gives plain quotes a detected kind without a title", () => {
		const root = run(rootOf([quote("A useful tip about caching")]), remarkCallouts);
		const node = firstChild(root);
		expect(node.data).toEqual({ hName: "aside", hProperties: { className: ["callout"], "data-kind": "tip" } });
		expect(node.type === "blockquote" ? node.children.length : 0).toBe(1);
	});
});

describe("glossary", () => {
	it("wraps whole-word terms and keeps the surrounding text", () => {
		const pieces = splitGlossaryTerms("Uses RBAC and RLS, not RBACX.");
		expect(pieces.map((piece) => piece.type)).toEqual(["text", "emphasis", "text", "emphasis", "text"]);
		const [, abbreviation] = pieces;
		expect(abbreviation).toMatchObject({ data: { hName: "abbr" } });
	});

	it("leaves text without terms untouched", () => {
		expect(splitGlossaryTerms("nothing here")).toEqual([{ type: "text", value: "nothing here" }]);
	});

	it("runs over paragraph text only", () => {
		const root = run(
			rootOf([
				{ type: "heading", depth: 2, children: [{ type: "text", value: "RBAC" }] },
				{ type: "paragraph", children: [{ type: "text", value: "RBAC rules" }] },
			]),
			remarkGlossary,
		);
		const [heading, paragraph] = root.children;
		expect(heading?.type === "heading" ? leading(heading.children)?.type : undefined).toBe("text");
		expect(paragraph?.type === "paragraph" ? leading(paragraph.children)?.type : undefined).toBe("emphasis");
	});
});

describe("images", () => {
	it("rewrites repo-relative URLs to the /images route", () => {
		expect(rewriteImageUrl("./images/a.png")).toBe("/images/a.png");
		expect(rewriteImageUrl("../../images/a.png")).toBe("/images/a.png");
		expect(rewriteImageUrl("images/a.png")).toBe("/images/a.png");
		expect(rewriteImageUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
	});

	it("rewrites image nodes", () => {
		const root = run(rootOf([{ type: "paragraph", children: [{ type: "image", url: "./images/x.png", alt: "x" }] }]), remarkImageUrls);
		const paragraph = firstChild(root);
		expect(paragraph.type === "paragraph" ? leading(paragraph.children) : undefined).toEqual({ type: "image", url: "/images/x.png", alt: "x" });
	});
});

describe("image gallery", () => {
	function table(withImages: boolean): Table {
		return {
			type: "table",
			children: [
				{
					type: "tableRow",
					children: [
						{ type: "tableCell", children: [{ type: "text", value: "Screen" }] },
						{ type: "tableCell", children: [{ type: "text", value: "Preview" }] },
					],
				},
				{
					type: "tableRow",
					children: [
						{ type: "tableCell", children: [{ type: "text", value: "Login (sign-in form)" }] },
						{ type: "tableCell", children: withImages ? [{ type: "image", url: "./images/login.png", alt: "Login" }] : [{ type: "text", value: "none" }] },
					],
				},
			],
		};
	}

	it("converts image tables into a gallery", () => {
		const root = run(rootOf([table(true)]), remarkImageGallery);
		const node = firstChild(root);
		expect(node.type).toBe("html");
		expect(node.type === "html" ? node.value : "").toContain('<img src="/images/login.png" alt="Login"');
		expect(node.type === "html" ? node.value : "").toContain("<span>sign-in form</span>");
	});

	it("leaves mixed tables alone", () => {
		const root = run(rootOf([table(false)]), remarkImageGallery);
		expect(firstChild(root).type).toBe("table");
	});

	it("escapes gallery HTML", () => {
		expect(galleryHtml([{ title: "<b>", description: "", src: "/a.png", alt: '"x"' }])).toContain("&lt;b&gt;");
	});
});

describe("mermaid", () => {
	it("turns mermaid fences into escaped pre.mermaid blocks", () => {
		const root = run(rootOf([{ type: "code", lang: "mermaid", value: "graph TD; A-->B<C>" }]), remarkMermaid);
		const node = firstChild(root);
		expect(node.type === "html" ? node.value : "").toBe('<div class="mermaid-diagram"><pre class="mermaid">graph TD; A--&gt;B&lt;C&gt;</pre></div>');
	});

	it("leaves other fences alone", () => {
		const root = run(rootOf([{ type: "code", lang: "ts", value: "const a = 1;" }]), remarkMermaid);
		expect(firstChild(root).type).toBe("code");
	});
});

describe("task markers", () => {
	it("replaces markers with symbols", () => {
		expect(replaceTaskMarker("[x] Done")).toBe("✓ Done");
		expect(replaceTaskMarker("[ ] Todo")).toBe("☐ Todo");
		expect(replaceTaskMarker("Plain")).toBeNull();
	});

	it("rewrites GFM task list items and clears the checkbox", () => {
		const root = run(
			rootOf([
				{
					type: "list",
					children: [{ type: "listItem", checked: true, children: [{ type: "paragraph", children: [{ type: "text", value: "Ship it" }] }] }],
				},
			]),
			remarkTaskMarkers,
		);
		const list = firstChild(root);
		const item = list.type === "list" ? leading(list.children) : undefined;
		expect(item?.checked).toBeNull();
		const paragraph = leading(item?.children);
		expect(paragraph?.type === "paragraph" ? leading(paragraph.children) : undefined).toEqual({ type: "text", value: "✓ Ship it" });
	});
});

describe("leading heading", () => {
	it("removes only the first top-level H1", () => {
		const root = run(
			rootOf([
				{ type: "heading", depth: 1, children: [{ type: "text", value: "Title" }] },
				{ type: "heading", depth: 1, children: [{ type: "text", value: "Second" }] },
			]),
			remarkStripFirstHeading,
		);
		expect(root.children.length).toBe(1);
	});
});
