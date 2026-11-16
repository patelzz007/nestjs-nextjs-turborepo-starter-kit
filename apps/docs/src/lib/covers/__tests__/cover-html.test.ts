import { describe, expect, it } from "vitest";

import {
	cardHtml,
	COVER_BAND_HEIGHT,
	COVER_HEIGHT,
	COVER_WIDTH,
	coverHtml,
	darkTokenHex,
	escapeHtml,
	highlightedCode,
	httpCode,
	screenshotHtml,
	type CoverAssets,
} from "../cover-html";
import type { CoverSpec } from "../cover-spec";

const HEX = /^#[0-9a-f]{6}$/u;
const ASSETS: CoverAssets = { fontSans: "file:///sans.woff2", fontMono: "file:///mono.woff2", screenshot: (name) => `file:///shots/${name}.webp` };

describe("escapeHtml", () => {
	it("escapes the characters that would break the page", () => {
		expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
	});
});

describe("darkTokenHex", () => {
	it("resolves a token to its dark-theme colour as #rrggbb", () => {
		expect(darkTokenHex("tone-blue")).toMatch(HEX);
		expect(darkTokenHex("tone-blue")).not.toBe(darkTokenHex("tone-red"));
	});
});

describe("highlightedCode", () => {
	it("draws one paragraph per line, each token in its One Dark Pro colour, comments AA-lifted like the docs'", async () => {
		const html = (await highlightedCode("const a = 1;\n// note", "typescript")).toLowerCase();

		expect(html.match(/<p>/gu)).toHaveLength(2);
		expect(html).toContain('<span style="color:#c678dd">const</span>');
		expect(html).toContain('<span style="color:#90949d">// note</span>');
	});
});

describe("httpCode", () => {
	it("colours the request line and headers, and highlights a body as JSON", async () => {
		const html = await httpCode('POST /api/v1/things HTTP/1.1\nCookie: a=b\nplain line\n\n{ "a": 1 }');

		expect(html).toContain('<span style="color:#c678dd">POST</span> <span style="color:#61afef">/api/v1/things</span>');
		expect(html).toContain('<span style="color:#e1717a">Cookie</span>');
		expect(html).toContain('<span style="color:#abb2bf">plain line</span>');
		expect(html).toContain("<p>&nbsp;</p>");
	});

	it("draws a request without a body as its head alone", async () => {
		await expect(httpCode("GET /x")).resolves.toBe('<p><span style="color:#c678dd">GET</span> <span style="color:#61afef">/x</span></p>');
	});
});

describe("cardHtml", () => {
	it.each([
		[{ kind: "code", language: "json", code: '{ "a": 1 }' }, "card code"],
		[{ kind: "http", code: "GET /x" }, "card code"],
		[{ kind: "diagram", source: "flowchart LR\n  a --> b" }, "<svg"],
		[{ kind: "outline", headings: ["First", "Second"] }, "<li><b>02</b>Second</li>"],
	] satisfies [Parameters<typeof cardHtml>[0], string][])("draws a %o card", async (detail, expected) => {
		await expect(cardHtml(detail, "Label")).resolves.toContain(expected);
	});

	it("draws a terminal's commands after a prompt and its comments plain", async () => {
		const html = await cardHtml(
			{
				kind: "terminal",
				lines: [
					{ text: "# note", tone: "comment" },
					{ text: "pnpm <x>", tone: "command" },
				],
			},
			"Terminal",
		);

		expect(html).toContain('<p class="comment"># note</p><p><b>$</b> pnpm &lt;x&gt;</p>');
	});

	it("draws a decision with its status in its tone, or without a status", async () => {
		const decision = { kind: "decision", number: "085", title: "Tiers", status: "Accepted", summary: "Why.", tags: ["rewards"] } satisfies Parameters<typeof cardHtml>[0];

		await expect(cardHtml(decision, "docs/adr/x.md")).resolves.toContain(`--status:${darkTokenHex("tone-green")}`);
		await expect(cardHtml({ ...decision, status: "Unheard" }, "x")).resolves.toContain(`--status:${darkTokenHex("muted-foreground")}`);
		await expect(cardHtml({ ...decision, status: null, tags: [] }, "x")).resolves.not.toContain("status");
		await expect(cardHtml(decision, "x")).resolves.toContain("<span>#rewards</span>");
	});

	it("draws a summary with the guide's title and description", async () => {
		const html = await cardHtml({ kind: "summary", title: "Guide", summary: "What it covers.", tags: [] }, "docs/x.md");

		expect(html).toContain("<h2>Guide</h2>");
		expect(html).toContain("What it covers.");
		expect(html).not.toContain('class="tags"');
	});
});

describe("screenshotHtml", () => {
	it("frames a phone screen as a phone and any other screen as a browser window", () => {
		expect(screenshotHtml("mobile-home", ASSETS)).toBe('<figure class="shot phone"><img src="file:///shots/mobile-home.webp" alt=""></figure>');
		expect(screenshotHtml("admin-home", ASSETS)).toContain('class="shot window"');
	});
});

describe("coverHtml", () => {
	it("is a page of the cover's size in the guide's tones, with its fonts, screenshot and card", async () => {
		const spec: CoverSpec = { slug: "x", screenshot: "admin-home", accents: ["tone-blue", "tone-teal"], detail: { kind: "outline", headings: ["One"] }, label: "docs/x.md" };
		const html = await coverHtml(spec, ASSETS);

		expect(COVER_BAND_HEIGHT).toBeLessThan(COVER_HEIGHT);
		expect(html).toContain(`width: ${String(COVER_WIDTH)}px; height: ${String(COVER_HEIGHT)}px`);
		expect(html).toContain(`--a: ${darkTokenHex("tone-blue")}; --b: ${darkTokenHex("tone-teal")}`);
		expect(html).toContain("file:///sans.woff2");
		expect(html).toContain("file:///shots/admin-home.webp");
		expect(html).toContain("<li><b>01</b>One</li>");
	});
});
