import { describe, expect, it } from "vitest";

import {
	CARD_MAX_COLUMNS,
	CARD_MAX_LINES,
	cardLines,
	clip,
	coverDetail,
	decisionStatus,
	isReadableDiagram,
	OUTLINE_MAX_HEADINGS,
	plainText,
	sectionHeadings,
	terminalLines,
	type CoverSource,
} from "../cover-detail";

const FENCE = "```";

function fence(language: string, lines: readonly string[]): string {
	return [`${FENCE}${language}`, ...lines, FENCE].join("\n");
}

function guide(body: string, overrides: Partial<CoverSource> = {}): CoverSource {
	return { slug: "technical/example", title: "Example", description: "What the example does.", tags: ["api", "rbac", "tenancy", "extra"], body, ...overrides };
}

const SMALL_DIAGRAM = ["flowchart LR", "  a[Start] --> b[End]"];
const FOUR_LINES = ["const a = 1;", "const b = 2;", "const c = 3;", "const d = 4;"];
const THREE_SECTIONS = "## One\n\ntext\n\n## Two\n\n## Three\n";

describe("plainText", () => {
	it("drops emphasis, code and link marks, and squeezes whitespace", () => {
		expect(plainText("Use **bold**, _it_, `code` and [a link](https://x.test)\n  here")).toBe("Use bold, it, code and a link here");
	});
});

describe("clip", () => {
	it("keeps short text and ends longer text in an ellipsis within the limit", () => {
		expect(clip("short", CARD_MAX_COLUMNS)).toBe("short");
		expect(clip("abcdefgh", 5)).toBe("abcd…");
	});
});

describe("cardLines", () => {
	it("trims the fence, turns tabs into spaces, and cuts it to the card's lines and columns", () => {
		const long = "x".repeat(CARD_MAX_COLUMNS + 10);
		const lines = cardLines(`\n\tindented\n${long}\n${Array.from({ length: CARD_MAX_LINES }, (_unused, index) => `line ${String(index)}`).join("\n")}\n`);

		expect(lines).toHaveLength(CARD_MAX_LINES);
		expect(lines.at(0)).toBe("indented");
		expect(lines.at(1)).toHaveLength(CARD_MAX_COLUMNS);
		expect(lines.at(1)?.endsWith("…")).toBe(true);
	});
});

describe("terminalLines", () => {
	it("keeps comments, drops a command's trailing note, and skips blank lines", () => {
		expect(terminalLines("# set up\npnpm setup     # install\n\npnpm dev")).toEqual([
			{ text: "# set up", tone: "comment" },
			{ text: "pnpm setup", tone: "command" },
			{ text: "pnpm dev", tone: "command" },
		]);
	});
});

describe("sectionHeadings", () => {
	it("lists ## headings outside code, as plain text", () => {
		expect(sectionHeadings(`## The \`api\` part\n\n${fence("md", ["## not a heading"])}\n\n## Two ##\n\n## Three`)).toEqual(["The api part", "Two", "Three"]);
	});

	it("adds ### headings when there are fewer than three ## ones", () => {
		expect(sectionHeadings("## One\n\n### One A\n\n### One B")).toEqual(["One", "One A", "One B"]);
	});
});

describe("decisionStatus", () => {
	it("reads the status from a ## Status section or a **Status:** line, and is null when none is named", () => {
		expect(decisionStatus("## Status\n\nProposed (2026-11-13).")).toBe("Proposed");
		expect(decisionStatus("**Status:** Accepted  \n**Date:** 2026")).toBe("Accepted");
		expect(decisionStatus("## Status\n\nIn review.")).toBeNull();
		expect(decisionStatus("No status here.")).toBeNull();
	});
});

describe("isReadableDiagram", () => {
	it("accepts a small diagram and rejects one Pele cannot parse or that is too big to read", () => {
		const huge = [
			"flowchart TD",
			...Array.from({ length: 20 }, (_unused, index) => `  n${String(index)}[Step ${String(index)}] --> n${String(index + 1)}[Step ${String(index + 1)}]`),
		];

		expect(isReadableDiagram(SMALL_DIAGRAM.join("\n"))).toBe(true);
		expect(isReadableDiagram("this is not a diagram")).toBe(false);
		expect(isReadableDiagram(huge.join("\n"))).toBe(false);
	});
});

describe("coverDetail", () => {
	it("shows an ADR's decision: number, status, title without its prefix, summary and up to three tags besides adr", () => {
		const detail = coverDetail(
			guide("## Status\n\nAccepted.", {
				slug: "adr/085-customer-tiers",
				title: "ADR 085: Customer Tiers",
				description: "A **tier** is platform-wide.",
				tags: ["adr", "a", "b", "c", "d"],
			}),
		);

		expect(detail).toEqual({ kind: "decision", number: "085", title: "Customer Tiers", status: "Accepted", summary: "A tier is platform-wide.", tags: ["a", "b", "c"] });
	});

	it("gives an ADR without a description an empty summary", () => {
		expect(coverDetail(guide("", { slug: "adr/001-x", title: "ADR 001: X", description: undefined }))).toMatchObject({ summary: "", status: null });
	});

	it("takes the first code that fills a card, passing over short and plain-text fences", () => {
		const body = [fence("ts", ["a();", "b();"]), fence("text", FOUR_LINES), fence("qr", FOUR_LINES), fence("", FOUR_LINES), fence("json", FOUR_LINES)].join("\n\n");

		expect(coverDetail(guide(body))).toEqual({ kind: "code", language: "json", code: FOUR_LINES.join("\n") });
	});

	it("gathers every shell command into one terminal", () => {
		const body = [fence("bash", ["pnpm install", "pnpm setup"]), "Then:", fence("sh", ["pnpm dev", "pnpm test"])].join("\n\n");

		expect(coverDetail(guide(body))).toEqual({
			kind: "terminal",
			lines: ["pnpm install", "pnpm setup", "pnpm dev", "pnpm test"].map((text) => ({ text, tone: "command" })),
		});
	});

	it("shows an HTTP request as it is written", () => {
		const request = ["GET /api/v1/things", "Cookie: session", "X-Client-Type: admin", "Accept: application/json"];

		expect(coverDetail(guide(fence("http", request)))).toEqual({ kind: "http", code: request.join("\n") });
	});

	it("draws a readable diagram, which fills a card however short its source", () => {
		expect(coverDetail(guide(fence("mermaid", SMALL_DIAGRAM)))).toEqual({ kind: "diagram", source: SMALL_DIAGRAM.join("\n") });
		expect(coverDetail(guide(`${fence("mermaid", ["not a diagram", "at all"])}\n\n${THREE_SECTIONS}`)).kind).toBe("outline");
	});

	it("prefers an outline of three or more sections over code too short to fill a card", () => {
		expect(coverDetail(guide(`${fence("ts", ["a();", "b();"])}\n\n${THREE_SECTIONS}`))).toEqual({ kind: "outline", headings: ["One", "Two", "Three"] });
	});

	it("lists at most the outline's maximum of headings", () => {
		const headings = Array.from({ length: OUTLINE_MAX_HEADINGS + 2 }, (_unused, index) => `Section ${String(index)}`);

		expect(coverDetail(guide(headings.map((heading) => `## ${heading}`).join("\n\n")))).toEqual({ kind: "outline", headings: headings.slice(0, OUTLINE_MAX_HEADINGS) });
	});

	it("falls back to the longest short code, then to the guide's summary", () => {
		const shortCode = [fence("ts", ["a();", "b();"]), fence("json", ["{", '"a": 1', "}"])].join("\n\n");

		expect(coverDetail(guide(shortCode))).toEqual({ kind: "code", language: "json", code: '{\n"a": 1\n}' });
		expect(coverDetail(guide("## Only one", { description: "The **whole** story." }))).toEqual({
			kind: "summary",
			title: "Example",
			summary: "The whole story.",
			tags: ["api", "rbac", "tenancy"],
		});
		expect(coverDetail(guide("", { description: undefined }))).toMatchObject({ kind: "summary", summary: "" });
	});
});
