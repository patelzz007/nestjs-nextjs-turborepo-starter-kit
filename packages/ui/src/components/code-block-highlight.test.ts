import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement, Fragment } from "react";
import type { ShikiTransformer } from "shiki";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	buildWordDecorations,
	codeBlockLanguages,
	codeBlockThemes,
	DEFAULT_CODE_BLOCK_THEMES,
	highlightCode,
	markdownCodeProps,
	markdownFences,
	normalizeCode,
	parseLineSpec,
	preloadCodeBlockHighlighter,
	resetCodeBlockHighlighter,
	resolveCodeBlockLanguage,
	stripNotationComments,
	toPlainLines,
	type CodeBlockLine,
} from "./code-block-highlight";

/** shiki's first pass loads the engine, a theme pair and a grammar. */
const SHIKI_TIMEOUT_MS = 30_000;

function lineAt(lines: CodeBlockLine[], index: number): CodeBlockLine {
	const line = lines[index];
	if (!line) throw new Error(`No line at index ${String(index)}`);
	return line;
}

describe("module contract", () => {
	it("keeps the highlight module free of a client directive and the component a client module", (): void => {
		const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
		expect(read("./code-block-highlight.ts")).not.toMatch(/^\s*["']use client["']/m);
		expect(read("./code-block.tsx").startsWith('"use client";')).toBe(true);
	});

	it("registers lazy grammar and theme loaders by name", (): void => {
		expect(Object.keys(codeBlockLanguages)).toEqual(expect.arrayContaining(["typescript", "tsx", "bash", "python", "json", "diff"]));
		expect(Object.keys(codeBlockThemes)).toEqual(["github-light", "github-dark", "css-variables"]);
		expect(DEFAULT_CODE_BLOCK_THEMES).toEqual({ light: "github-light", dark: "github-dark" });
	});
});

describe("resolveCodeBlockLanguage", () => {
	it("resolves aliases case- and whitespace-insensitively", (): void => {
		expect(resolveCodeBlockLanguage("TS")).toBe("typescript");
		expect(resolveCodeBlockLanguage(" tsx ")).toBe("tsx");
		expect(resolveCodeBlockLanguage("sh")).toBe("shell");
		expect(resolveCodeBlockLanguage("zsh")).toBe("shell");
		expect(resolveCodeBlockLanguage("c++")).toBe("cpp");
		expect(resolveCodeBlockLanguage("C#")).toBe("csharp");
		expect(resolveCodeBlockLanguage("yml")).toBe("yaml");
		expect(resolveCodeBlockLanguage("dockerfile")).toBe("docker");
		expect(resolveCodeBlockLanguage("mdx")).toBe("markdown");
	});

	it("reports unavailable grammars as undefined", (): void => {
		expect(resolveCodeBlockLanguage(undefined)).toBeUndefined();
		expect(resolveCodeBlockLanguage("")).toBeUndefined();
		expect(resolveCodeBlockLanguage("brainfuck")).toBeUndefined();
		expect(resolveCodeBlockLanguage("constructor")).toBeUndefined();
		expect(resolveCodeBlockLanguage("toString")).toBeUndefined();
	});
});

describe("parseLineSpec", () => {
	it("accepts arrays of positive integers only", (): void => {
		expect([...parseLineSpec([3, 2, 0, -1, 1.5, 2])]).toEqual([3, 2]);
	});

	it("parses single lines and ranges", (): void => {
		expect([...parseLineSpec("2-4,7")]).toEqual([2, 3, 4, 7]);
		expect([...parseLineSpec(" 1 - 2 , 5 ")]).toEqual([1, 2, 5]);
	});

	it("is total: garbage, reversed and negative input yield nothing", (): void => {
		expect(parseLineSpec(undefined).size).toBe(0);
		expect(parseLineSpec("").size).toBe(0);
		expect(parseLineSpec([]).size).toBe(0);
		expect([...parseLineSpec("4-2, x, -3, 5-, ,0,0-2,8")]).toEqual([8]);
		expect(parseLineSpec("lines 1 to 3").size).toBe(0);
	});
});

describe("normalizeCode", () => {
	it("turns CRLF and CR into LF", (): void => {
		expect(normalizeCode("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
	});
});

describe("buildWordDecorations", () => {
	const code = "foo bar foo\nfoo baz";

	it("returns nothing without words", (): void => {
		expect(buildWordDecorations(code)).toEqual([]);
		expect(buildWordDecorations(code, [])).toEqual([]);
		expect(buildWordDecorations(code, [""])).toEqual([]);
	});

	it("marks every occurrence, sorted by offset", (): void => {
		expect(buildWordDecorations(code, ["foo"])).toEqual([
			{ start: 0, end: 3, properties: { class: "cb-word" } },
			{ start: 8, end: 11, properties: { class: "cb-word" } },
			{ start: 12, end: 15, properties: { class: "cb-word" } },
		]);
	});

	it("restricts matches to the given source lines", (): void => {
		expect(buildWordDecorations(code, [{ word: "foo", lines: [2] }])).toEqual([{ start: 12, end: 15, properties: { class: "cb-word" } }]);
		expect(buildWordDecorations(code, [{ word: "foo", lines: "1" }]).map((d) => d.start)).toEqual([0, 8]);
		/* An empty limit means "every line". */
		expect(buildWordDecorations(code, [{ word: "foo" }])).toHaveLength(3);
	});

	it("drops a later match that would overlap an earlier one", (): void => {
		const decorations = buildWordDecorations(code, ["foo bar", "bar", "baz"]);
		expect(decorations.map((d) => [d.start, d.end])).toEqual([
			[0, 7],
			[16, 19],
		]);
	});
});

describe("stripNotationComments", () => {
	it("removes [!code ...] notation in every comment syntax and keeps the code", (): void => {
		const source = [
			"const a = 1; // [!code ++]",
			"echo hi # [!code highlight]",
			"<div /> <!-- [!code --] -->",
			"body { } /* [!code focus] */",
			"select 1 -- [!code error]",
			"plain // not notation",
		].join("\n");
		expect(stripNotationComments(source)).toBe(["const a = 1;", "echo hi", "<div />", "body { }", "select 1", "plain // not notation"].join("\n"));
	});
});

describe("toPlainLines", () => {
	it("splits into uncoloured, numbered lines with empty token lists for blanks", (): void => {
		expect(toPlainLines("a\r\n\nb", 5)).toEqual([
			{ tokens: [{ content: "a" }], number: 5, text: "a" },
			{ tokens: [], number: 6, text: "" },
			{ tokens: [{ content: "b" }], number: 7, text: "b" },
		]);
		expect(toPlainLines("x").map((line) => line.number)).toEqual([1]);
	});
});

describe("highlightCode (real shiki)", () => {
	afterEach((): void => {
		resetCodeBlockHighlighter();
		vi.restoreAllMocks();
	});

	it(
		"produces light and dark coloured tokens and merges prop line state",
		async (): Promise<void> => {
			const code = 'const answer = 42;\nlet name = "x";\nanswer;';
			const lines = await highlightCode(code, {
				language: "ts",
				startLine: 10,
				highlightedLines: [1],
				focusedLines: "1",
				diff: { added: [2], removed: "3" },
				lineLevels: { error: [2], warning: "3" },
				highlightedWords: [{ word: "answer", lines: [3] }],
			});

			expect(lines.map((line) => line.number)).toEqual([10, 11, 12]);
			expect(lines.map((line) => line.text)).toEqual(code.split("\n"));

			const keyword = lineAt(lines, 0).tokens.find((token) => token.content.includes("const"));
			expect(keyword?.color).toMatch(/^#[0-9a-f]{6}$/i);
			expect(keyword?.colorDark).toMatch(/^#[0-9a-f]{6}$/i);
			expect(keyword?.color).not.toBe(keyword?.colorDark);

			expect(lineAt(lines, 0).state).toEqual({ highlighted: true, focused: true });
			expect(lineAt(lines, 1).state).toEqual({ diff: "add", level: "error" });
			expect(lineAt(lines, 2).state).toEqual({ diff: "remove", level: "warning" });

			const marked = lineAt(lines, 2).tokens.filter((token) => token.word);
			expect(marked.map((token) => token.content).join("")).toBe("answer");
			expect(lineAt(lines, 0).tokens.some((token) => token.word)).toBe(false);
		},
		SHIKI_TIMEOUT_MS,
	);

	it(
		"reuses unchanged line objects across passes of the same instance",
		async (): Promise<void> => {
			const first = await highlightCode("const a = 1;\nconst b", { language: "typescript", instanceKey: "stream" });
			const second = await highlightCode("const a = 1;\nconst b = 2;", { language: "typescript", instanceKey: "stream" });
			expect(second[0]).toBe(first[0]);
			expect(second[1]).not.toBe(first[1]);
		},
		SHIKI_TIMEOUT_MS,
	);

	it(
		"maps transformer line classes onto line state",
		async (): Promise<void> => {
			const transformer: ShikiTransformer = {
				name: "test:mark-second-line",
				line(node, line): void {
					if (line === 2) this.addClassToHast(node, ["diff", "remove", "info"]);
				},
			};
			const lines = await highlightCode("a;\nb;", { language: "js", transformers: [transformer] });
			expect(lineAt(lines, 1).state).toEqual({ diff: "remove", level: "info" });
			expect(lineAt(lines, 0).state).toBeUndefined();
		},
		SHIKI_TIMEOUT_MS,
	);

	it(
		"falls back to the matching default theme, once, with a dev warning",
		async (): Promise<void> => {
			const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
			const lines = await highlightCode("const a = 1;", { language: "ts", themes: { light: "nope-light", dark: "nope-dark" } });
			expect(lineAt(lines, 0).tokens.some((token) => token.color !== undefined)).toBe(true);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown theme "nope-dark" - falling back to "github-dark"'));
		},
		SHIKI_TIMEOUT_MS,
	);

	it("returns plain lines for an unknown language without loading shiki", async (): Promise<void> => {
		expect(await highlightCode("a\r\nb", { language: "klingon", startLine: 3 })).toEqual(toPlainLines("a\nb", 3));
		expect(await highlightCode("a")).toEqual(toPlainLines("a"));
	});

	it(
		"returns plain lines when a transformer throws",
		async (): Promise<void> => {
			const broken: ShikiTransformer = {
				name: "test:broken",
				preprocess(): string {
					throw new Error("boom");
				},
			};
			expect(await highlightCode("const a = 1;", { language: "ts", transformers: [broken] })).toEqual(toPlainLines("const a = 1;"));
		},
		SHIKI_TIMEOUT_MS,
	);
});

describe("preloadCodeBlockHighlighter", () => {
	afterEach((): void => {
		resetCodeBlockHighlighter();
		vi.restoreAllMocks();
	});

	it(
		"loads grammars up front, so highlighting no longer needs a lazy import",
		async (): Promise<void> => {
			await preloadCodeBlockHighlighter({ languages: ["ts", "not-a-language"] });
			// Simulate a closed module runner: any further lazy grammar import fails.
			vi.spyOn(codeBlockLanguages, "typescript").mockRejectedValue(new Error("Vite module runner has been closed."));

			const lines = await highlightCode("const answer = 42;", { language: "ts" });
			const keyword = lineAt(lines, 0).tokens.find((token) => token.content === "const");
			expect(keyword?.color).toBeDefined();
			expect(keyword?.colorDark).toBeDefined();
		},
		SHIKI_TIMEOUT_MS,
	);

	it(
		"without a preload, a failing grammar import degrades to plain text",
		async (): Promise<void> => {
			vi.spyOn(codeBlockLanguages, "typescript").mockRejectedValue(new Error("Vite module runner has been closed."));
			const lines = await highlightCode("const answer = 42;", { language: "ts" });
			expect(lines).toEqual(toPlainLines("const answer = 42;"));
		},
		SHIKI_TIMEOUT_MS,
	);
});

describe("markdownCodeProps", () => {
	it("reads code and language from a react-markdown pre, dropping the trailing newline", (): void => {
		const children = createElement("code", { className: "language-tsx" }, "const a = 1;\n");
		expect(markdownCodeProps({ children })).toEqual({ code: "const a = 1;", language: "tsx" });
	});

	it("concatenates nested elements, arrays and numbers in order", (): void => {
		const children = createElement("code", { className: "hljs language-c++" }, ["x = ", 42, createElement("span", null, ";", createElement(Fragment, null, " // done"))]);
		expect(markdownCodeProps({ children })).toEqual({ code: "x = 42; // done", language: "c++" });
	});

	it("takes the pre's own className first, then the first language class found", (): void => {
		const children = createElement("code", { className: "language-js" }, "a");
		expect(markdownCodeProps({ className: "language-py", children }).language).toBe("py");
		expect(markdownCodeProps({ children: [createElement("code", { className: "language-go" }, "a"), createElement("code", { className: "language-rs" }, "b")] })).toEqual({
			code: "ab",
			language: "go",
		});
	});

	it("is tolerant: no language, empty, boolean and unreadable children yield plain text", (): void => {
		expect(markdownCodeProps({})).toEqual({ code: "", language: undefined });
		expect(markdownCodeProps({ children: [null, undefined, false, true, "plain"] })).toEqual({ code: "plain", language: undefined });
		expect(markdownCodeProps({ children: createElement("code", { className: "nothing" }, "a") })).toEqual({ code: "a", language: undefined });
		expect(markdownCodeProps({ children: [Promise.resolve("later"), "kept"] })).toEqual({ code: "kept", language: undefined });
	});

	it("only strips one trailing newline", (): void => {
		expect(markdownCodeProps({ children: "a\n\n" }).code).toBe("a\n");
	});
});

describe("markdownFences", () => {
	it("splits prose from closed fences, with the info word as the language", (): void => {
		expect(markdownFences("Intro\n\n```ts\nconst a = 1;\n```\n\nOutro")).toEqual([
			{ type: "text", content: "Intro", open: false },
			{ type: "code", content: "const a = 1;", language: "ts", open: false },
			{ type: "text", content: "Outro", open: false },
		]);
	});

	it("reports an unterminated trailing fence as open code (the streaming case)", (): void => {
		expect(markdownFences("Here:\n```py\nprint(1)")).toEqual([
			{ type: "text", content: "Here:", open: false },
			{ type: "code", content: "print(1)", language: "py", open: true },
		]);
		expect(markdownFences("```")).toEqual([{ type: "code", content: "", language: undefined, open: true }]);
	});

	it("needs a closer of the opener's character, at least as long, with no info word", (): void => {
		const markdown = "````md\n```ts\nx\n```\n~~~\n````";
		expect(markdownFences(markdown)).toEqual([{ type: "code", content: "```ts\nx\n```\n~~~", language: "md", open: false }]);
		expect(markdownFences("~~~\na\n~~~~")).toEqual([{ type: "code", content: "a", language: undefined, open: false }]);
	});

	it("returns prose only, trimmed, and nothing for blank input", (): void => {
		expect(markdownFences("  just text  \n")).toEqual([{ type: "text", content: "just text", open: false }]);
		expect(markdownFences("")).toEqual([]);
	});
});
