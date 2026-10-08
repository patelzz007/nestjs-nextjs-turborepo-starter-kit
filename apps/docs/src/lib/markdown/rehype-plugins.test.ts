import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";

import { isExternalHref, rehypeExternalLinks, rehypeHeadingAnchors, rehypeTableWrapper } from "./rehype-plugins";

function element(tagName: string, properties: Element["properties"], children: Element["children"] = []): Element {
	return { type: "element", tagName, properties, children };
}

function rootOf(children: Element[]): Root {
	return { type: "root", children };
}

describe("rehypeHeadingAnchors", () => {
	it("appends a permalink to h2-h4 headings with an id", () => {
		const heading = element("h2", { id: "setup" }, [{ type: "text", value: "Setup" }]);
		rehypeHeadingAnchors()(rootOf([heading]));
		const [, permalink] = heading.children;
		expect(permalink).toMatchObject({ tagName: "a", properties: { href: "#setup", className: ["heading-anchor"] } });
	});

	it("skips h1 and headings without an id", () => {
		const h1 = element("h1", { id: "title" });
		const h2 = element("h2", {});
		rehypeHeadingAnchors()(rootOf([h1, h2]));
		expect(h1.children).toEqual([]);
		expect(h2.children).toEqual([]);
	});
});

describe("rehypeExternalLinks", () => {
	it("opens external links in a new tab", () => {
		const link = element("a", { href: "https://example.com" });
		const internal = element("a", { href: "/docs/technical/database" });
		rehypeExternalLinks()(rootOf([link, internal]));
		expect(link.properties).toMatchObject({ target: "_blank", rel: ["noopener", "noreferrer"] });
		expect(internal.properties.target).toBeUndefined();
	});

	it("classifies hrefs", () => {
		expect(isExternalHref("http://a.b")).toBe(true);
		expect(isExternalHref("#anchor")).toBe(false);
	});
});

describe("rehypeTableWrapper", () => {
	it("wraps tables in a scroll container", () => {
		const root = rootOf([element("table", {})]);
		rehypeTableWrapper()(root);
		const [wrapper] = root.children;
		expect(wrapper).toMatchObject({ tagName: "div", properties: { className: ["table-wrapper"] } });
	});
});
