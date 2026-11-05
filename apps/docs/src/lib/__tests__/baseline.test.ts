import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { BaselineSchema, canonicalPath, compareWithBaseline, decodeEntities, RENAMED_ANCHORS, snapshotOf, type Baseline, type PageSnapshot } from "../baseline";

const PAGE = `<html><head><title>Messaging · Monorepo Docs</title><link rel="canonical" href="https://docs.example.com/docs/messaging"/><meta property="og:image" content="https://img.example/a.jpg?w=1&amp;q=2"/></head>
<body><h1 class="title">Messaging <span>&amp; jobs</span></h1><h2 id="queues">Queues</h2><h3 class="x" id="retries">Retries</h3><h5 id="ignored">No</h5></body></html>`;

const SNAPSHOT: PageSnapshot = {
	title: "Messaging · Monorepo Docs",
	h1: "Messaging & jobs",
	headingIds: ["queues", "retries"],
	canonical: "https://docs.example.com/docs/messaging",
	ogImage: "https://img.example/a.jpg?w=1&q=2",
};

function baseline(pages: Record<string, PageSnapshot>, files: readonly string[] = []): Baseline {
	return { pages, files: [...files] };
}

describe("snapshotOf", () => {
	it("should read the title, the h1's text, the h2–h4 anchors, the canonical URL and the sharing image", () => {
		expect(snapshotOf(PAGE)).toEqual(SNAPSHOT);
	});

	it("should leave what a page does not have empty", () => {
		expect(snapshotOf("<html></html>")).toEqual({ title: "", h1: "", headingIds: [], canonical: null, ogImage: null });
	});
});

describe("canonicalPath and decodeEntities", () => {
	it("should compare canonical URLs by path, without the .html the Astro build appended", () => {
		expect(canonicalPath("http://localhost:3002/docs/messaging.html")).toBe("/docs/messaging");
		expect(canonicalPath("https://docs.example.com/index.html")).toBe("/");
		expect(canonicalPath(null)).toBeNull();
	});

	it("should decode the entities a page escapes and keep unknown ones", () => {
		expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#x27; &copy;")).toBe(`a & b <c> "d" 'e' &copy;`);
	});
});

describe("compareWithBaseline", () => {
	it("should pass when every page and file is still served the same way", () => {
		const astro = { ...SNAPSHOT, canonical: "http://localhost:3002/docs/messaging.html", headingIds: ["queues"] };
		expect(compareWithBaseline(baseline({ "/docs/messaging": astro }, ["/feed.xml"]), new Map([["/docs/messaging", SNAPSHOT]]), new Set(["/feed.xml"]))).toEqual([]);
	});

	it("should report a missing page, a missing file, and every fact that changed", () => {
		const changed: PageSnapshot = { title: "Other", h1: "Other", headingIds: [], canonical: "https://docs.example.com/docs/other", ogImage: null };
		expect(compareWithBaseline(baseline({ "/docs/messaging": SNAPSHOT, "/docs/gone": SNAPSHOT }, ["/feed.xml"]), new Map([["/docs/messaging", changed]]), new Set())).toEqual([
			'/docs/messaging: title "Messaging · Monorepo Docs" → "Other"',
			'/docs/messaging: h1 "Messaging & jobs" → "Other"',
			"/docs/messaging: og:image https://img.example/a.jpg?w=1&q=2 → null",
			"/docs/messaging: canonical https://docs.example.com/docs/messaging → https://docs.example.com/docs/other",
			"/docs/messaging: anchors lost: queues, retries",
			"/docs/gone: page missing",
			"/feed.xml: file missing",
		]);
	});

	it("should skip the documented changes and only check anchors on guides and posts", () => {
		const home: PageSnapshot = { ...SNAPSHOT, headingIds: ["section-a"] };
		expect(compareWithBaseline(baseline({ "/404": SNAPSHOT, "/": home }, ["/sitemap-index.xml"]), new Map([["/", { ...home, headingIds: [] }]]), new Set())).toEqual([]);
	});
});

describe("renamed anchors", () => {
	const route = "/docs/technical/tooling/typescript";
	const oldAnchor = "typescript-7-and-the-two-places-typescript-6-remains";
	const newAnchor = "typescript-7-and-the-one-place-typescript-6-remains";
	const before: PageSnapshot = { ...SNAPSHOT, headingIds: [oldAnchor] };

	it("should record the TypeScript guide's renamed heading", () => {
		expect(RENAMED_ANCHORS[route]).toEqual({ [oldAnchor]: newAnchor });
	});

	it("should accept a deliberately renamed anchor when its replacement is on the page", () => {
		expect(compareWithBaseline(baseline({ [route]: before }), new Map([[route, { ...SNAPSHOT, headingIds: [newAnchor] }]]), new Set())).toEqual([]);
	});

	it("should still report the anchor when the replacement is missing too", () => {
		expect(compareWithBaseline(baseline({ [route]: before }), new Map([[route, { ...SNAPSHOT, headingIds: [] }]]), new Set())).toEqual([
			`${route}: anchors lost: ${oldAnchor}`,
		]);
	});
});

describe("the committed baseline", () => {
	it("should be a valid capture of the Astro site", () => {
		const baseline = BaselineSchema.parse(JSON.parse(readFileSync(new URL("../../../regression-baseline/routes.json", import.meta.url), "utf8")));
		expect(Object.keys(baseline.pages)).toContain("/docs/technical/authorization/overview");
		expect(baseline.files).toContain("/feed.xml");
	});
});
