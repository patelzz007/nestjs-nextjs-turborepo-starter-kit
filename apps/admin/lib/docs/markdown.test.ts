import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	detectQuoteKind,
	estimateReadingTime,
	extractTocHeadings,
	filterDocSummaries,
	formatEpochDate,
	headingText,
	normalizeSearchQuery,
	parseMarkdownFile,
	slugifyHeadingText,
	stripFirstHeading,
	type QuoteKind,
} from "@/lib/docs/markdown";

describe("slugifyHeadingText", () => {
	it("matches the renderer's slug format (lowercase, non-alphanumerics become dashes)", () => {
		expect(slugifyHeadingText("Getting Started — A-to-Z Setup Guide")).toBe("getting-started-a-to-z-setup-guide");
		expect(slugifyHeadingText("1. What you're building")).toBe("1-what-you-re-building");
		expect(slugifyHeadingText("Everyday commands cheat sheet")).toBe("everyday-commands-cheat-sheet");
		expect(slugifyHeadingText("  Trimmed  ")).toBe("trimmed");
	});
});

describe("headingText", () => {
	it("strips inline markdown from heading lines", () => {
		expect(headingText("Install `pnpm` **now**")).toBe("Install pnpm now");
		expect(headingText("[Getting Started](./getting-started.md)")).toBe("Getting Started");
		expect(headingText("_emphasized_ and ~struck~")).toBe("emphasized and struck");
	});
});

describe("extractTocHeadings", () => {
	it("extracts h2/h3 headings with text, level, and slug id", () => {
		const markdown = "# Title\n\n## Section One\n\nSome text.\n\n### Sub section\n\nMore text.\n\n#### Skipped h4\n\n## Last Section";
		const headings = extractTocHeadings(markdown);

		expect(headings.map((heading) => heading.text)).toEqual(["Section One", "Sub section", "Last Section"]);
		expect(headings.map((heading) => heading.level)).toEqual([2, 3, 2]);
		expect(headings.map((heading) => heading.id)).toEqual(["section-one", "sub-section", "last-section"]);
	});

	it("ignores the h1 title and empty headings", () => {
		const headings = extractTocHeadings("# Only a title\n\n### \n\n## Real Section");
		expect(headings.map((heading) => heading.text)).toEqual(["Real Section"]);
	});

	it("skips heading-like lines inside fenced code blocks", () => {
		const markdown = "## Real Section\n\n```bash\n## Not a heading\n### also not\n```\n\n## After Code";
		const headings = extractTocHeadings(markdown);
		expect(headings.map((heading) => heading.text)).toEqual(["Real Section", "After Code"]);
	});

	it("handles tildes fences and a heading-like line right after a closing fence", () => {
		const markdown = "## Before\n\n~~~\n## Inside tilde fence\n~~~\n\n### Real Subsection";
		const headings = extractTocHeadings(markdown);
		expect(headings.map((heading) => heading.text)).toEqual(["Before", "Real Subsection"]);
	});
});

describe("stripFirstHeading", () => {
	it("removes a leading H1 plus the blank line after it", () => {
		expect(stripFirstHeading("# Getting Started\n\nBody.")).toBe("Body.");
		expect(stripFirstHeading("# Title\nBody right after.")).toBe("Body right after.");
	});

	it("leaves content without a leading H1 unchanged", () => {
		const body = "Just a paragraph.\n\n## Section";
		expect(stripFirstHeading(body)).toBe(body);
	});
});

describe("parseMarkdownFile", () => {
	it("parses all fields from YAML frontmatter", () => {
		const source =
			'---\ntitle: "Prisma & Database"\ndescription: How to run db commands\norder: 3\nauthor: "Acme Inc."\nlastUpdated: 1785628800000\ncoverImage: "https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1600&q=80"\n---\n\n# Heading\n\nBody text.';
		const parsed = parseMarkdownFile(source);

		expect(parsed.frontmatter.title).toBe("Prisma & Database");
		expect(parsed.frontmatter.description).toBe("How to run db commands");
		expect(parsed.frontmatter.order).toBe(3);
		expect(parsed.frontmatter.author).toBe("Acme Inc.");
		expect(parsed.frontmatter.lastUpdated).toBe(1785628800000);
		expect(parsed.frontmatter.coverImage).toBe("https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1600&q=80");
		expect(parsed.body).toBe("# Heading\n\nBody text.");
	});

	it("returns the whole file as the body when there is no frontmatter", () => {
		const source = "# No Frontmatter\n\nSome content.";
		const parsed = parseMarkdownFile(source);

		expect(parsed.frontmatter).toEqual({});
		expect(parsed.body).toBe(source);
	});

	it("falls back to empty frontmatter when the block is unclosed", () => {
		const source = "---\ntitle: Never Closed\n\n# Real content";
		const parsed = parseMarkdownFile(source);

		expect(parsed.frontmatter).toEqual({});
		expect(parsed.body).toBe(source);
	});

	it("ignores invalid frontmatter values instead of throwing", () => {
		const source = "---\ntitle: 12345\norder: not-a-number\n---\n\nBody.";
		const parsed = parseMarkdownFile(source);

		expect(parsed.frontmatter).toEqual({});
		expect(parsed.body).toBe("Body.");
	});

	it("supports single-quoted and unquoted values", () => {
		const source = "---\ntitle: 'Getting Started'\ndescription: plain text\n---\n\nBody.";
		const parsed = parseMarkdownFile(source);

		expect(parsed.frontmatter.title).toBe("Getting Started");
		expect(parsed.frontmatter.description).toBe("plain text");
	});
});

describe("normalizeSearchQuery", () => {
	it("trims, lowercases, and collapses whitespace", () => {
		expect(normalizeSearchQuery("  Prisma   DB ")).toBe("prisma db");
		expect(normalizeSearchQuery("   ")).toBe("");
	});
});
describe("filterDocSummaries", () => {
	const docs: readonly { readonly title: string; readonly description: string }[] = [
		{ title: "Prisma & Database", description: "The database layer" },
		{ title: "Auth Guide", description: "How to run the prisma seed" },
		{ title: "Getting Started", description: "From an empty laptop" },
	];

	it("filters by title and description, case-insensitively", () => {
		const result = filterDocSummaries(docs, "PRISMA");
		expect(result.map((doc) => doc.title)).toEqual(["Prisma & Database", "Auth Guide"]);
	});

	it("ranks title matches above description matches", () => {
		const result = filterDocSummaries(docs, "prisma");
		expect(result[0]?.title).toBe("Prisma & Database");
		expect(result[1]?.title).toBe("Auth Guide");
		expect(result).toHaveLength(2);
	});

	it("returns every doc unchanged (in order) for an empty query", () => {
		expect(filterDocSummaries(docs, "   ")).toEqual([...docs]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(filterDocSummaries(docs, "billing")).toEqual([]);
	});
});

describe("estimateReadingTime", () => {
	it("returns at least 1 minute and scales with word count", () => {
		expect(estimateReadingTime("short")).toBe(1);
		expect(estimateReadingTime("word ".repeat(400))).toBe(2);
		expect(estimateReadingTime("")).toBe(1);
	});
});

describe("formatEpochDate", () => {
	it("formats an epoch-ms timestamp as 'Aug 2, 2026' (UTC calendar day, timezone-independent)", () => {
		expect(formatEpochDate(epochMs(1785628800000))).toBe("Aug 2, 2026");
	});
});

describe("integration with the real docs/ folder", () => {
	it("parses frontmatter (incl. author + lastUpdated) from every docs/*.md file", async () => {
		const { readFile, readdir } = await import("node:fs/promises");
		const path = await import("node:path");
		const dir = path.resolve(process.cwd(), "../../docs");

		const files = (await readdir(dir)).filter((file) => file.endsWith(".md"));
		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			const content = await readFile(path.join(dir, file), "utf8");
			const parsed = parseMarkdownFile(content);

			expect(parsed.body.length, file).toBeGreaterThan(0);
			if (parsed.frontmatter.title !== undefined) {
				expect(parsed.frontmatter.title.length, file).toBeGreaterThan(0);
			}
			if (parsed.frontmatter.order !== undefined) {
				expect(Number.isInteger(parsed.frontmatter.order), file).toBe(true);
			}
			if (parsed.frontmatter.author !== undefined) {
				expect(parsed.frontmatter.author.length, file).toBeGreaterThan(0);
			}
			if (parsed.frontmatter.lastUpdated !== undefined) {
				expect(Number.isInteger(parsed.frontmatter.lastUpdated), file).toBe(true);
			}
			if (parsed.frontmatter.coverImage !== undefined) {
				expect(parsed.frontmatter.coverImage, file).toMatch(/^https:\/\//);
			}
		}
	});
});

describe("detectQuoteKind", () => {
	const cases: readonly { readonly text: string; readonly expected: QuoteKind }[] = [
		// Error keywords.
		{ text: "This throws an error when the token is invalid", expected: "error" },
		{ text: "The request failed with a network timeout", expected: "error" },
		{ text: "❌ Do not merge yet", expected: "error" },
		// Warning keywords.
		{ text: "Warning: this wipes volatile demo data", expected: "warning" },
		{ text: "Caution — the scheduler leak contract is important", expected: "warning" },
		{ text: "⚠ Never run this against production", expected: "warning" },
		{ text: "Login gotcha: the cookie must be httpOnly", expected: "warning" },
		// Success keywords.
		{ text: "✅ Done — all tests pass", expected: "success" },
		{ text: "Success: the migration applied cleanly", expected: "success" },
		// Tip keywords — their own kind (violet), distinct from success.
		{ text: "Tip: keep the tuple ordering stable", expected: "tip" },
		{ text: "💡 Wrap long-running queries in a transaction", expected: "tip" },
		// Neutral prose stays info — no substring false positives.
		{ text: "The do's and don'ts that keep the machinery stable", expected: "info" },
		{ text: "An antipattern to avoid is premature optimization", expected: "info" },
		{ text: "Start here — this guide explains the big picture", expected: "info" },
	];

	for (const testCase of cases) {
		it(`classifies "${testCase.text}" as ${testCase.expected}`, () => {
			expect(detectQuoteKind(testCase.text)).toBe(testCase.expected);
		});
	}
});
