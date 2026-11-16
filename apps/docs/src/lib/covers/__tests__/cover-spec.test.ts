import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cardLabel, COVER_TONES, coverAccents, coverSpec, coverUrl, NOTION_HOME_SPEC, stableHash } from "../cover-spec";

const SCREENSHOTS = fileURLToPath(new URL("../../../../../../docs/images/readme/", import.meta.url));

describe("stableHash", () => {
	it("is the same for the same text and differs for different text", () => {
		expect(stableHash("adr/085-customer-tiers")).toBe(stableHash("adr/085-customer-tiers"));
		expect(stableHash("a")).not.toBe(stableHash("b"));
		expect(stableHash("")).toBe(0x811c9dc5);
	});
});

describe("coverAccents", () => {
	it("gives every slug two different cover tones, and the same two each time", () => {
		const slugs = Array.from({ length: 200 }, (_unused, index) => `guide-${String(index)}`);

		for (const slug of slugs) {
			const [first, second] = coverAccents(slug);
			expect(first).not.toBe(second);
			expect(COVER_TONES).toContain(first);
			expect(COVER_TONES).toContain(second);
			expect(coverAccents(slug)).toEqual([first, second]);
		}
		expect(new Set(slugs.map((slug) => coverAccents(slug).join())).size).toBeGreaterThan(COVER_TONES.length);
	});
});

describe("cardLabel", () => {
	it("names code by its language, a request, a terminal, and otherwise the guide's file", () => {
		const slug = "technical/x";

		expect(cardLabel(slug, { kind: "code", language: "typescript", code: "" })).toBe("TypeScript");
		expect(cardLabel(slug, { kind: "code", language: "rust", code: "" })).toBe("rust");
		expect(cardLabel(slug, { kind: "http", code: "" })).toBe("HTTP request");
		expect(cardLabel(slug, { kind: "terminal", lines: [] })).toBe("Terminal");
		expect(cardLabel(slug, { kind: "outline", headings: [] })).toBe("docs/technical/x.md");
		expect(cardLabel(slug, { kind: "summary", title: "", summary: "", tags: [] })).toBe("docs/technical/x.md");
		expect(cardLabel(slug, { kind: "diagram", source: "" })).toBe("docs/technical/x.md");
		expect(cardLabel(slug, { kind: "decision", number: "001", title: "", status: null, summary: "", tags: [] })).toBe("docs/technical/x.md");
	});
});

describe("coverSpec", () => {
	it("joins the guide's screenshot, tones, card and label", () => {
		const spec = coverSpec({ slug: "technical/kanban", title: "Kanban", description: "Boards.", tags: [], body: "## A\n\n## B\n\n## C" });

		expect(spec).toEqual({
			slug: "technical/kanban",
			screenshot: "admin-kanban-dark",
			accents: coverAccents("technical/kanban"),
			detail: { kind: "outline", headings: ["A", "B", "C"] },
			label: "docs/technical/kanban.md",
		});
	});
});

describe("NOTION_HOME_SPEC", () => {
	it("is drawn to the file the Notion layout uploads, on a screenshot that exists", () => {
		expect(NOTION_HOME_SPEC.slug).toBe("notion-home");
		expect(existsSync(`${SCREENSHOTS}${NOTION_HOME_SPEC.screenshot}.webp`)).toBe(true);
	});
});

describe("coverUrl", () => {
	it("is the guide's path under /images/covers/, as WebP", () => {
		expect(coverUrl("adr/085-customer-tiers")).toBe("/images/covers/adr/085-customer-tiers.webp");
	});
});
