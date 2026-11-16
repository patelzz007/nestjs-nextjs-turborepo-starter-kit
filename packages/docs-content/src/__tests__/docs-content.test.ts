import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { assetLink, pageLink, resolvePlaceholders, type SourceDocumentMeta } from "../document.ts";
import { generatedFile, type GeneratedPageFacts } from "../front-matter.ts";
import { CorruptManifestError, EMPTY_MANIFEST, parseManifest, serialiseManifest, type Manifest, type ManifestEntry } from "../manifest.ts";
import { mergeBlogNavigation, mergeDocsNavigation, parseNavigation, serialiseNavigation } from "../navigation.ts";
import { buildRedirects, redirectProblems, serialiseRedirects } from "../redirects.ts";
import { filePathFor, isSafeSlug, siteUrlFor } from "../slug.ts";
import { documentIssues, workspaceProblems } from "../validation.ts";

function meta(overrides: Partial<SourceDocumentMeta> = {}): SourceDocumentMeta {
	return {
		sourceId: "a",
		sourceUrl: "https://tool.example/a",
		collection: "docs",
		title: "A",
		slug: "guides/a",
		description: "About A.",
		section: "Guides",
		order: 1,
		author: "Ada",
		tags: ["x"],
		category: "Engineering",
		publishedAt: 7,
		lastUpdated: 8,
		editedAt: 10,
		cover: null,
		issues: [],
		...overrides,
	};
}

function entry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
	return {
		source: "NOTION",
		sourceId: "a",
		sourceUrl: null,
		collection: "docs",
		slug: "guides/a",
		title: "A",
		previousSlugs: [],
		section: "Guides",
		order: 1,
		filePath: "docs/guides/a.md",
		contentHash: "hash",
		converterVersion: 1,
		editedAt: 10,
		lastRunId: "run",
		links: [],
		assets: [],
		...overrides,
	};
}

function manifest(...entries: ManifestEntry[]): Manifest {
	return { ...EMPTY_MANIFEST, entries };
}

describe("isSafeSlug", () => {
	it.each(["setup", "technical/api/README", "adr/075-platform-deploys", "user-guide/01-platform-setup", "a.b_c"])("accepts %s", (slug) => {
		expect(isSafeSlug(slug, "docs")).toBe(true);
	});

	it.each([
		"",
		"../secrets",
		"a/../b",
		"/etc/passwd",
		"a//b",
		"a b",
		"a/",
		"-a",
		"blog/post",
		"history/notes",
		"images/x",
		"generated/openapi",
		"sync/manifest",
		"x".repeat(201),
	])("refuses %j", (slug) => {
		expect(isSafeSlug(slug, "docs")).toBe(false);
	});

	it("reserves folders only for guides", () => {
		expect(isSafeSlug("images/gallery", "blog")).toBe(true);
	});
});

describe("filePathFor and siteUrlFor", () => {
	it("places guides and posts", () => {
		expect(filePathFor("a/b", "docs")).toBe("docs/a/b.md");
		expect(filePathFor("a", "blog")).toBe("docs/blog/a.md");
		expect(siteUrlFor("a/b", "docs")).toBe("/docs/a/b");
		expect(siteUrlFor("a", "blog")).toBe("/blog/a");
	});
});

describe("resolvePlaceholders", () => {
	const resolver = {
		assetPath: (key: string): string => `/images/${key}.png`,
		pagePath: (id: string): string => `${id}.md`,
		pageTitle: (id: string): string => `Title of ${id}`,
	};

	it("fills in assets, links and titles", () => {
		const markdown = `![x](${assetLink("a b")}) [y](${pageLink("p1")}) [docs-sync-title](${pageLink("p2")})`;

		expect(resolvePlaceholders(markdown, resolver)).toBe("![x](/images/a b.png) [y](p1.md) [Title of p2](p2.md)");
	});
});

describe("documentIssues", () => {
	it("accepts a complete guide with no cover: a missing cover never blocks a fix", () => {
		expect(documentIssues(meta())).toEqual([]);
	});

	it.each([
		["title", { title: "" }],
		["slug", { slug: null }],
		["slug", { slug: "" }],
		["slug", { slug: "../x" }],
		["description", { description: null }],
		["section", { section: null }],
		["order", { order: null }],
		["category", { category: null }],
		["publish date", { publishedAt: null }],
		["last-updated date", { lastUpdated: null }],
	])("requires a guide's %s", (word, overrides) => {
		expect(documentIssues(meta(overrides)).map((issue) => issue.reason.toLowerCase())).toEqual([expect.stringContaining(word)]);
	});

	it("puts the source's own findings first, and does not repeat 'no slug' when the source said why", () => {
		const finding = { blockId: null, blockType: null, reason: "The folder above this page is missing.", fix: "Set Parent to a folder." };

		expect(documentIssues(meta({ slug: null, issues: [finding] }))).toEqual([finding]);
		expect(documentIssues(meta({ issues: [finding], description: null })).map((issue) => issue.reason)).toEqual([finding.reason, "The page has no description."]);
	});

	const post = meta({ collection: "blog", section: null, order: null, category: "News", publishedAt: 5, cover: { kind: "external", url: "https://a.example/c.png" } });

	it("accepts a complete post", () => {
		expect(documentIssues(post)).toEqual([]);
	});

	it.each([
		["cover", { cover: null }],
		["author", { author: null }],
		["category", { category: null }],
		["publish date", { publishedAt: null }],
		["last-updated date", { lastUpdated: null }],
	])("requires a post's %s", (word, overrides) => {
		expect(documentIssues({ ...post, ...overrides }).map((issue) => issue.reason)).toEqual([expect.stringContaining(word)]);
	});
});

describe("workspaceProblems", () => {
	it("finds two documents after one file, whatever the case", () => {
		expect(workspaceProblems([meta(), meta({ sourceId: "b", slug: "GUIDES/A" })])).toEqual([expect.stringContaining("is used by both a and b")]);
	});

	it("lets a guide and a post share a slug", () => {
		expect(workspaceProblems([meta(), meta({ sourceId: "b", collection: "blog" })])).toEqual([]);
	});

	it("leaves an unsafe slug to the page-level rules", () => {
		expect(workspaceProblems([meta({ slug: "../x" }), meta({ sourceId: "b", slug: "../x" })])).toEqual([]);
	});
});

describe("generatedFile", () => {
	const facts: GeneratedPageFacts = { source: "NOTION", coverImage: null, defaultAuthor: "Platform Team" };

	it("writes a guide's front matter, and is the same every time", () => {
		const file = generatedFile(meta(), facts, "Body\n");

		expect(file).toBe(generatedFile(meta(), facts, "Body\n"));
		expect(file).toContain("<!-- Generated by the docs sync. Edit it at the source: https://tool.example/a -->");
		const yaml = /^---\n(?<yaml>[\s\S]*?)---\n/u.exec(file)?.groups?.yaml ?? "";
		expect(parseYaml(yaml)).toEqual({
			title: "A",
			description: "About A.",
			order: 1,
			author: "Ada",
			category: "Engineering",
			date: 7,
			lastUpdated: 8,
			editedAt: 10,
			tags: ["x"],
			source: { kind: "NOTION", id: "a", url: "https://tool.example/a" },
		});
	});

	it("names the document when the tool has no web address, and falls back to the default author", () => {
		const file = generatedFile(meta({ sourceUrl: null, author: null }), facts, "Body");

		expect(file).toContain("Edit it at the source: NOTION document a");
		expect(file).toContain("author: Platform Team");
	});

	it("writes a post's front matter", () => {
		const file = generatedFile(meta({ collection: "blog", category: "News", publishedAt: 5 }), { ...facts, coverImage: "/images/c.png" }, "Body");

		expect(file).toContain("date: 5");
		expect(file).toContain("category: News");
		expect(file).toContain("lastUpdated: 8");
		expect(file).toContain("editedAt: 10");
		expect(file).toContain("coverImage: /images/c.png");
	});
});

describe("manifest", () => {
	it("round-trips, sorted, so the same state gives the same bytes", () => {
		const first = entry({ sourceId: "b", slug: "b" });
		const second = entry({ sourceId: "a", slug: "a" });

		const text = serialiseManifest(manifest(first, second));

		expect(text).toBe(serialiseManifest(manifest(second, first)));
		expect(parseManifest(text).entries.map((item) => item.sourceId)).toEqual(["a", "b"]);
	});

	it("refuses what is not a manifest", () => {
		expect(() => parseManifest("{ nope")).toThrow(CorruptManifestError);
		expect(() => parseManifest(JSON.stringify({ version: 99, entries: [], tombstones: [] }))).toThrow(CorruptManifestError);
	});
});

describe("redirects", () => {
	it("builds one redirect per old slug, sorted", () => {
		const redirects = buildRedirects(
			manifest(entry({ slug: "c", previousSlugs: ["z", "b"] }), entry({ sourceId: "p", collection: "blog", slug: "new", previousSlugs: ["old"] })),
		);

		expect(redirects).toEqual([
			{ from: "/blog/old", to: "/blog/new" },
			{ from: "/docs/b", to: "/docs/c" },
			{ from: "/docs/z", to: "/docs/c" },
		]);
		expect(serialiseRedirects(redirects)).toContain('"from": "/blog/old"');
	});

	it("accepts a clean list", () => {
		const state = manifest(entry({ slug: "b", previousSlugs: ["a"] }));

		expect(redirectProblems(buildRedirects(state), state)).toEqual([]);
	});

	it("refuses a duplicate source", () => {
		const state = manifest(entry({ slug: "b", previousSlugs: ["a"] }), entry({ sourceId: "c", slug: "c", previousSlugs: ["a"] }));

		expect(redirectProblems(buildRedirects(state), state)).toEqual([expect.stringContaining("Two pages claim")]);
	});

	it("refuses a clash with a live page", () => {
		const state = manifest(entry({ slug: "b", previousSlugs: ["a"] }), entry({ sourceId: "c", slug: "a" }));

		expect(redirectProblems(buildRedirects(state), state)).toEqual([expect.stringContaining("is a live page")]);
	});

	it("refuses a loop", () => {
		const state = manifest(entry({ slug: "a", previousSlugs: ["a"] }));

		expect(redirectProblems(buildRedirects(state), state)).toEqual([expect.stringContaining("to itself")]);
	});

	it("refuses a redirect to a missing page", () => {
		expect(redirectProblems([{ from: "/docs/a", to: "/docs/gone" }], manifest())).toEqual([expect.stringContaining("not a page")]);
	});
});

describe("mergeDocsNavigation", () => {
	const base = { title: "Guides", pages: ["top", "--- Start ---", "README", "guides/a", "--- Old ---", "guides/old"] };

	it("leaves pages no source owns where they are", () => {
		const merged = mergeDocsNavigation(base, [entry({ section: "Start" })], []);

		expect(merged.pages).toEqual(["top", "--- Start ---", "README", "guides/a", "--- Old ---", "guides/old"]);
	});

	it("orders synced pages inside their section, and adds a new section at the end", () => {
		const second = entry({ sourceId: "b", slug: "guides/b", section: "New", order: 2 });
		const first = entry({ sourceId: "c", slug: "guides/c", section: "New", order: 1 });

		expect(mergeDocsNavigation({ pages: [] }, [second, first], []).pages).toEqual(["--- New ---", "guides/c", "guides/b"]);
	});

	it("breaks an order tie by slug, and puts unordered pages last", () => {
		const pages = [entry({ sourceId: "b", slug: "b", order: 1 }), entry({ sourceId: "a", slug: "a", order: 1 }), entry({ sourceId: "z", slug: "z", order: null })];

		expect(mergeDocsNavigation({ pages: [] }, pages, []).pages).toEqual(["--- Guides ---", "a", "b", "z"]);
	});

	it("drops a page that moved, and a section left empty", () => {
		const merged = mergeDocsNavigation(base, [entry({ section: "Start" })], ["guides/old"]);

		expect(merged.pages).toEqual(["top", "--- Start ---", "README", "guides/a"]);
	});

	it("keeps a page with no section at the top", () => {
		expect(mergeDocsNavigation({ pages: ["x"] }, [entry({ section: null })], []).pages).toEqual(["x", "guides/a"]);
	});

	it("reads and writes the file form", () => {
		expect(parseNavigation(serialiseNavigation(base))).toEqual(base);
	});
});

describe("mergeBlogNavigation", () => {
	it("keeps hand-written posts and adds synced ones", () => {
		const merged = mergeBlogNavigation({ title: "Blog", pages: ["old", "gone"] }, [entry({ slug: "new", collection: "blog" })], ["gone"]);

		expect(merged).toEqual({ title: "Blog", pages: ["old", "new"] });
	});
});
