import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";

import { isExternalHref, rehypeExternalLinks, rehypeHeadingAnchors, rehypeTableWrapper } from "../rehype-plugins";

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

/** A table with one cell holding `<code>{text}</code>`, and that code element. */
function tableWithCode(text: string): { readonly root: Root; readonly code: Element } {
	const code = element("code", {}, [{ type: "text", value: text }]);
	const root = rootOf([element("table", {}, [element("tbody", {}, [element("tr", {}, [element("td", {}, [code])])])])]);
	return { root, code };
}

/** The code element's children as a string, `<wbr>` written out. */
function withBreaks(code: Element): string {
	return code.children.map((child) => (child.type === "text" ? child.value : child.type === "element" ? `<${child.tagName}>` : "")).join("");
}

describe("rehypeTableWrapper", () => {
	it("wraps tables in a scroll container", () => {
		const root = rootOf([element("table", {})]);
		rehypeTableWrapper()(root);
		const [wrapper] = root.children;
		expect(wrapper).toMatchObject({ tagName: "div", properties: { className: ["table-wrapper"] } });
	});

	it("offers a break after each / and . of a path in a table cell", () => {
		const { root, code } = tableWithCode("src/config/api-config.ts");
		rehypeTableWrapper()(root);
		expect(withBreaks(code)).toBe("src/<wbr>config/<wbr>api-config.<wbr>ts");
	});

	it("breaks a long identifier after its underscores, and keeps a short one whole", () => {
		const long = tableWithCode("WEBHOOK_RATE_LIMIT_PER_MINUTE");
		const short = tableWithCode("EMAIL_PROVIDER");
		rehypeTableWrapper()(long.root);
		rehypeTableWrapper()(short.root);
		expect(withBreaks(long.code)).toBe("WEBHOOK_<wbr>RATE_<wbr>LIMIT_<wbr>PER_<wbr>MINUTE");
		expect(withBreaks(short.code)).toBe("EMAIL_PROVIDER");
	});

	it("never adds a break at the end of a chip, and leaves code outside tables alone", () => {
		const { root, code } = tableWithCode("THROTTLE_*_SECONDS_PER_WINDOW_");
		const outside = element("code", {}, [{ type: "text", value: "src/config" }]);
		rehypeTableWrapper()({ type: "root", children: [...root.children, element("p", {}, [outside])] });
		expect(withBreaks(code).endsWith("<wbr>")).toBe(false);
		expect(withBreaks(outside)).toBe("src/config");
	});
});
