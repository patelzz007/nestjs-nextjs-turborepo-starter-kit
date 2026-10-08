import { describe, expect, it } from "vitest";

import { highlightTerms, MAX_INDEXED_CHARACTERS, queryTerms, SearchIndexSchema, searchIndex, toPlainText, type SearchEntry } from "./search";

function entry(overrides: Partial<SearchEntry>): SearchEntry {
	return { kind: "page", title: "Untitled", href: "/docs/x", context: "Guides", text: "", ...overrides };
}

describe("toPlainText", () => {
	it("drops code fences, markup, links and HTML", () => {
		const markdown = "## Setup\n\nRun **pnpm** and see [the guide](./a.md).\n\n```ts\nconst secret = 1;\n```\n\n> Note <br/> ![alt text](x.png)\n\n| a | b |\n|---|---|";
		const text = toPlainText(markdown);
		expect(text).toContain("Setup Run pnpm and see the guide.");
		expect(text).toContain("alt text");
		expect(text).not.toContain("secret");
		expect(text).not.toContain("<br/>");
		expect(text).not.toContain("---");
	});

	it("caps the indexed length", () => {
		expect(toPlainText("word ".repeat(10_000))).toHaveLength(MAX_INDEXED_CHARACTERS);
	});
});

describe("searchIndex", () => {
	const index: readonly SearchEntry[] = [
		entry({ title: "Prisma", href: "/docs/technical/database", text: "Row level security policies" }),
		entry({ title: "Row-level security", href: "/docs/technical/database#rls", kind: "heading", context: "Prisma" }),
		entry({ title: "Email", href: "/docs/technical/email/templates", text: "Resend webhooks and templates" }),
	];

	it("requires every term and ranks title matches first", () => {
		const hits = searchIndex(index, "security", 10);
		expect(hits.map((hit) => hit.entry.href)).toEqual(["/docs/technical/database#rls", "/docs/technical/database"]);
	});

	it("returns an excerpt around body-only matches", () => {
		const [hit] = searchIndex(index, "webhooks", 10);
		expect(hit?.excerpt).toBe("Resend webhooks and templates");
		const [emailHit] = searchIndex(index, "email", 10);
		expect(emailHit?.excerpt).toBe("");
	});

	it("honours the limit and ignores empty queries", () => {
		expect(searchIndex(index, "   ", 10)).toEqual([]);
		expect(searchIndex(index, "s", 1)).toHaveLength(1);
		expect(searchIndex(index, "security nothing", 10)).toEqual([]);
	});

	it("validates the index payload", () => {
		expect(SearchIndexSchema.safeParse(index).success).toBe(true);
		const [firstEntry] = index;
		expect(SearchIndexSchema.safeParse([{ ...firstEntry, kind: "blog" }]).success).toBe(false);
	});
});

describe("query helpers", () => {
	it("splits, lowercases and de-duplicates terms", () => {
		expect(queryTerms("  RLS rls  Prisma ")).toEqual(["rls", "prisma"]);
	});

	it("escapes HTML and marks every term", () => {
		expect(highlightTerms("Use <RLS> and rls", ["rls"])).toBe("Use &lt;<mark>RLS</mark>&gt; and <mark>rls</mark>");
		expect(highlightTerms("a.b", ["."])).toBe("a<mark>.</mark>b");
		expect(highlightTerms("<x>", [])).toBe("&lt;x&gt;");
	});
});
