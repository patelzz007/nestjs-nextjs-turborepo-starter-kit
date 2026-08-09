// @vitest-environment jsdom
//
// Docs render-integrity sweep — renders EVERY docs/*.md file through the real
// MarkdownRenderer pipeline and asserts that no code block or callout renders
// as an empty box. This reproduces the "code block appears but the wording
// doesn't" bug deterministically (the browser-only spot checks can't be
// automated and were flaky).
//
// shiki + mermaid are mocked so the sweep is fast and hermetic: CodeBlock's
// highlighted body is a <pre> either way, and MermaidDiagram renders a
// placeholder div (never a <pre>), so the assertions below are unaffected.

import { cleanup, render } from "@testing-library/react";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { parseMarkdownFile } from "@/lib/docs/markdown";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** First ~160 chars of a rendered element's HTML, one line — for self-diagnosing failures. */
function htmlSnippet(element: Element): string {
	return element.outerHTML.replace(/\s+/g, " ").slice(0, 160);
}

vi.mock("shiki", () => ({
	createHighlighter: vi.fn().mockResolvedValue({
		codeToHtml: (code: string): string => `<pre><code>${code}</code></pre>`,
	}),
}));

vi.mock("mermaid", () => ({
	default: {
		initialize: vi.fn(),
		render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }),
	},
}));

afterEach(cleanup);

describe("docs render integrity sweep", () => {
	it("renders every docs/*.md with NO empty code blocks and NO empty callouts", async () => {
		const dir = path.resolve(process.cwd(), "../../docs");
		const files = (await readdir(dir)).filter((file) => file.endsWith(".md"));
		expect(files.length).toBeGreaterThan(0);

		const problems: string[] = [];

		for (const file of files) {
			const content = await readFile(path.join(dir, file), "utf8");
			const { body } = parseMarkdownFile(content);
			const { container } = render(<MarkdownRenderer content={body} />);

			// 1. Every code block body must have visible text. CodeBlock's body
			//    is a <pre> whether shiki is mocked (highlighted) or not (plain).
			const pres = container.querySelectorAll("pre");
			pres.forEach((pre, index) => {
				const text = pre.textContent.trim();
				if (text.length === 0) {
					problems.push(`${file}: EMPTY code block #${String(index)} (pre with no text)`);
				}
			});

			// 2. Every callout must have visible text — a blockquote with only
			//    an icon + empty content is the "box appears, wording missing" bug.
			const blockquotes = container.querySelectorAll("blockquote");
			blockquotes.forEach((quote, index) => {
				const text = quote.textContent.trim();
				if (text.length === 0) {
					problems.push(`${file}: EMPTY callout #${String(index)} (blockquote with no text) — ${htmlSnippet(quote)}`);
				}
				// 3. A leaked marker (e.g. `[!NOTE]` rendering verbatim) means the
				//    strip logic regressed — the marker must never appear at the
				//    start of a rendered callout.
				if (/^\[![A-Z]+\]/.test(text)) {
					problems.push(`${file}: LEAKED marker in callout #${String(index)} — ${htmlSnippet(quote)}`);
				}
			});

			cleanup();
		}

		expect(problems).toEqual([]);
	});

	it("renders both marker shapes — canonical (own-line) and inline (with bold title)", () => {
		// Canonical: `> [!NOTE]` alone, then content — marker paragraph must vanish.
		const canonical = "# Doc\n\n> [!NOTE]\n>\n> Canonical body.";
		const { container: canonicalBox } = render(<MarkdownRenderer content={canonical} />);
		const canonicalQuote = canonicalBox.querySelector("blockquote");
		expect(canonicalQuote?.textContent.replace(/\s+/g, " ").trim()).toBe("Canonical body.");
		cleanup();

		// Inline: `> [!NOTE] **Title:** body` — title AND body must survive the
		// marker strip (this is the "empty callout" regression).
		const inline = "# Doc\n\n> [!NOTE] **Why?** The title and this body must both render.";
		const { container: inlineBox } = render(<MarkdownRenderer content={inline} />);
		const inlineQuote = inlineBox.querySelector("blockquote");
		expect(inlineQuote?.textContent.replace(/\s+/g, " ").trim()).toContain("Why?");
		expect(inlineQuote?.textContent.replace(/\s+/g, " ").trim()).toContain("title and this body must both render");
	});
});
