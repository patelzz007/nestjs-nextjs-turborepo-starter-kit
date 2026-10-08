// Title: Code Block Highlight
// Description: Isomorphic shiki engine and pure helpers for the code block.
// Ported from ReUI (https://reui.io/r/base-vega/code-block-highlight.json).
// ReUI ships this file as .tsx; nothing in it renders JSX, so it stays a
// plain .ts module. The unified-diff and ANSI parsers were dropped as unused
// (their hex palette also bypasses the kit's design tokens); the markdown
// helpers are kept. The other deviations are type-level only (no casts, no
// `unknown`, real shiki/hast types, zod-read React trees) and are listed in
// packages/ui/README.md.

/**
 * No "use client" directive, deliberately: a server component awaits
 * `highlightCode` and passes `lines` down, costing the client nothing. The
 * contract test asserts the directive stays absent. shiki loads lazily inside
 * `loadHighlighter`, so importing a helper from here bundles no engine.
 */

import type { Element, ElementContent, Properties, Root } from "hast";
import { isArrayValue, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import type { ReactNode } from "react";
import type { DecorationItem, HighlighterCore, LanguageInput, ShikiTransformer, ThemeInput } from "shiki";
import { z } from "zod";

/**
 * One themed slice of a line. `color`/`colorDark` emit as `--cb-c`/`--cb-cd`
 * custom properties, so one rule pair on the `<pre>` theme-switches the whole
 * block. An uncoloured token keeps both undefined and renders as a bare text
 * node with no wrapper.
 */
export interface CodeBlockToken {
	content: string;
	color?: string | undefined;
	colorDark?: string | undefined;
	fontStyle?: CodeBlockFontStyle | undefined;
	word?: boolean | undefined;
}

export type CodeBlockFontStyle = "italic" | "bold" | "underline";

export type CodeBlockDiffKind = "add" | "remove";

export type CodeBlockLevel = "error" | "warning" | "info";

/** Every line level, in the order a later one wins over an earlier one. */
const CODE_BLOCK_LEVELS: readonly CodeBlockLevel[] = ["error", "warning", "info"];

/**
 * Per-line presentation state, resolved once at highlight time.
 *
 * Two sources merge here: the props on the root, and the classes a shiki
 * transformer put on the line, so `@shikijs/transformers` notation such as
 * `[!code ++]` reaches the same place without the renderer knowing shiki
 * exists. Props win on conflict, because notation lives in the source string,
 * which a consumer often does not control.
 */
export interface CodeBlockLineState {
	highlighted?: boolean;
	diff?: CodeBlockDiffKind;
	focused?: boolean;
	level?: CodeBlockLevel;
}

/**
 * A rendered line. `number` is the DISPLAYED number (offset by `startLine`);
 * line specs address source lines, so changing `startLine` never invalidates
 * them. Instances are reused across passes when unchanged, which is what lets
 * the row be a plain `React.memo` and a streamed chunk cost one re-render.
 */
export interface CodeBlockLine {
	tokens: CodeBlockToken[];
	number: number;
	text: string;
	state?: CodeBlockLineState | undefined;
	/**
	 * Replaces the counter-driven gutter number for this row - a unified patch
	 * shows "old new" pairs, a hunk header shows dots. Rendered verbatim.
	 */
	gutter?: string | undefined;
}

/** Source lines, as `[2, 3, 4]` or as a range string such as `"2-4,7"`. */
export type CodeBlockLineSpec = number[] | string;

export interface CodeBlockDiffSpec {
	added?: CodeBlockLineSpec | undefined;
	removed?: CodeBlockLineSpec | undefined;
}

export type CodeBlockLevelSpec = Partial<Record<CodeBlockLevel, CodeBlockLineSpec | undefined>>;

/** A word to mark, optionally restricted to some source lines. */
export type CodeBlockWordSpec = string | { word: string; lines?: CodeBlockLineSpec | undefined };

export interface CodeBlockThemes {
	light: string;
	dark: string;
}

/**
 * shiki's own transformer type, imported type-only so it erases at compile
 * time and costs the bundle nothing. The previous structural stand-in
 * (`Record<string, unknown>`) rejected every real `ShikiTransformer`: an
 * interface without an index signature is not assignable to it.
 */
export type CodeBlockTransformer = ShikiTransformer;

export interface CodeBlockHighlightOptions {
	language?: string | undefined;
	themes?: CodeBlockThemes | undefined;
	transformers?: CodeBlockTransformer[] | undefined;
	startLine?: number | undefined;
	/**
	 * Distinguishes same-signature blocks in the line-reuse cache. Without it,
	 * two identically-configured streams evict each other's previous document.
	 * The root passes its own instance id.
	 */
	instanceKey?: string | undefined;
	highlightedLines?: CodeBlockLineSpec | undefined;
	highlightedWords?: CodeBlockWordSpec[] | undefined;
	focusedLines?: CodeBlockLineSpec | undefined;
	diff?: CodeBlockDiffSpec | undefined;
	lineLevels?: CodeBlockLevelSpec | undefined;
}

/** What a `CodeBlockLineActions` render prop receives. */
export interface CodeBlockLineActionContext {
	line: number;
	text: string;
	state?: CodeBlockLineState | undefined;
}

export type CodeBlockLineActionsRender = (context: CodeBlockLineActionContext) => ReactNode;

/* -------------------------------------------------------------------------- */
/*                                  Languages                                  */
/* -------------------------------------------------------------------------- */

/**
 * A STATIC map, never ``import(`shiki/langs/${lang}.mjs`)``: a template import
 * makes bundlers bundle all ~200 grammars. Written out, each entry is its own
 * lazy chunk. To add a language, add a line: that is the intended extension
 * point of this file.
 */
export const codeBlockLanguages: Record<string, () => Promise<LanguageInput>> = {
	bash: () => import("shiki/langs/bash.mjs"),
	c: () => import("shiki/langs/c.mjs"),
	cpp: () => import("shiki/langs/cpp.mjs"),
	csharp: () => import("shiki/langs/csharp.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	docker: () => import("shiki/langs/docker.mjs"),
	go: () => import("shiki/langs/go.mjs"),
	graphql: () => import("shiki/langs/graphql.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	java: () => import("shiki/langs/java.mjs"),
	javascript: () => import("shiki/langs/javascript.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsx: () => import("shiki/langs/jsx.mjs"),
	kotlin: () => import("shiki/langs/kotlin.mjs"),
	markdown: () => import("shiki/langs/markdown.mjs"),
	php: () => import("shiki/langs/php.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	ruby: () => import("shiki/langs/ruby.mjs"),
	rust: () => import("shiki/langs/rust.mjs"),
	scss: () => import("shiki/langs/scss.mjs"),
	shell: () => import("shiki/langs/shellscript.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	swift: () => import("shiki/langs/swift.mjs"),
	toml: () => import("shiki/langs/toml.mjs"),
	tsx: () => import("shiki/langs/tsx.mjs"),
	typescript: () => import("shiki/langs/typescript.mjs"),
	vue: () => import("shiki/langs/vue.mjs"),
	yaml: () => import("shiki/langs/yaml.mjs"),
};

/** Spellings a consumer is likely to pass, mapped onto the map above. */
const LANGUAGE_ALIASES: Record<string, string> = {
	"c++": "cpp",
	"c#": "csharp",
	cs: "csharp",
	dockerfile: "docker",
	htm: "html",
	js: "javascript",
	jsonc: "json",
	md: "markdown",
	mdx: "markdown",
	py: "python",
	rb: "ruby",
	rs: "rust",
	sh: "shell",
	shellscript: "shell",
	ts: "typescript",
	yml: "yaml",
	zsh: "shell",
};

/**
 * Design-token theming: every token colour becomes a `var(--code-token-*)`
 * reference, so the palette lives in the consumer's stylesheet and follows
 * their themes. Pass as BOTH sides. Variables consumed (prefix `--code-`):
 * foreground, token-constant, token-string, token-comment, token-keyword,
 * token-parameter, token-function, token-string-expression,
 * token-punctuation, token-link.
 */
async function loadCssVariablesTheme(): Promise<ThemeInput> {
	const { createCssVariablesTheme } = await import("shiki/core");
	return createCssVariablesTheme({
		name: "css-variables",
		variablePrefix: "--code-",
		fontStyle: true,
	});
}

function loadGithubLightTheme(): Promise<ThemeInput> {
	return import("shiki/themes/github-light.mjs");
}

function loadGithubDarkTheme(): Promise<ThemeInput> {
	return import("shiki/themes/github-dark.mjs");
}

/* Theme names are the shiki names, so the loaders are named functions: the
   kit's naming convention rejects kebab-case object-literal methods. */
export const codeBlockThemes: Record<string, () => Promise<ThemeInput>> = {
	"github-light": loadGithubLightTheme,
	"github-dark": loadGithubDarkTheme,
	"css-variables": loadCssVariablesTheme,
};

export const DEFAULT_CODE_BLOCK_THEMES: CodeBlockThemes = {
	light: "github-light",
	dark: "github-dark",
};

/**
 * Own-key lookup. A bare `in` / index read also finds `Object.prototype`
 * members, so `language="constructor"` used to "resolve" to a function.
 */
function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Resolves an alias and reports whether the grammar is actually available. */
export function resolveCodeBlockLanguage(language?: string): string | undefined {
	if (!language) return undefined;
	const normalized = language.trim().toLowerCase();
	const resolved = ownValue(LANGUAGE_ALIASES, normalized) ?? normalized;
	return Object.hasOwn(codeBlockLanguages, resolved) ? resolved : undefined;
}

/* -------------------------------------------------------------------------- */
/*                                Pure helpers                                 */
/* -------------------------------------------------------------------------- */

const LINE_RANGE_RE = /^(?<start>\d+)\s*-\s*(?<end>\d+)$/;
const LINE_SINGLE_RE = /^\d+$/;

/**
 * Turns `[2, 3]` or `"2-4,7"` into a set of source line numbers.
 *
 * Deliberately total: a reversed range, a negative bound or outright garbage
 * yields an empty set rather than throwing. These values often come from user
 * content or from a model, and a code viewer that crashes on a bad range is
 * worse than one that shows no highlight.
 */
export function parseLineSpec(spec?: CodeBlockLineSpec): Set<number> {
	const out = new Set<number>();
	if (!spec) return out;

	if (!isStringPrimitive(spec)) {
		for (const value of spec) {
			if (Number.isInteger(value) && value > 0) out.add(value);
		}
		return out;
	}

	for (const part of spec.split(",")) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const range = LINE_RANGE_RE.exec(trimmed);
		if (range) {
			const start = Number(range.groups?.start);
			const end = Number(range.groups?.end);
			if (start > 0 && end >= start) {
				for (let line = start; line <= end; line += 1) out.add(line);
			}
			continue;
		}

		if (LINE_SINGLE_RE.test(trimmed)) {
			const single = Number(trimmed);
			if (single > 0) out.add(single);
		}
	}

	return out;
}

/** Normalises line endings so every downstream offset is LF-based. */
export function normalizeCode(code: string): string {
	return code.replace(/\r\n?/g, "\n");
}

/** A `highlightedWords` match, in shiki's `decorations` shape. */
export interface CodeBlockWordDecoration extends DecorationItem {
	start: number;
	end: number;
	properties: { class: string };
}

/**
 * Character ranges for `highlightedWords`, as shiki `decorations`.
 *
 * shiki rejects overlapping decorations, so a later match that would overlap an
 * earlier one is dropped rather than passed through to throw.
 */
export function buildWordDecorations(code: string, words?: CodeBlockWordSpec[]): CodeBlockWordDecoration[] {
	if (!words?.length) return [];

	const lineStarts: number[] = [0];
	for (let index = 0; index < code.length; index += 1) {
		if (code[index] === "\n") lineStarts.push(index + 1);
	}

	const lineAt = (offset: number): number => {
		let low = 0;
		let high = lineStarts.length - 1;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if ((lineStarts[mid] ?? 0) <= offset) low = mid;
			else high = mid - 1;
		}
		return low + 1;
	};

	const taken: { start: number; end: number }[] = [];
	const out: CodeBlockWordDecoration[] = [];

	for (const entry of words) {
		const word = isStringPrimitive(entry) ? entry : entry.word;
		if (!word) continue;
		const limit = isStringPrimitive(entry) ? undefined : parseLineSpec(entry.lines);

		let from = code.indexOf(word);
		while (from !== -1) {
			const to = from + word.length;
			const withinLimit = !limit || limit.size === 0 || limit.has(lineAt(from));
			const overlaps = taken.some((r) => from < r.end && to > r.start);

			if (withinLimit && !overlaps) {
				taken.push({ start: from, end: to });
				out.push({ start: from, end: to, properties: { class: "cb-word" } });
			}
			from = code.indexOf(word, from + word.length);
		}
	}

	return out.sort((a, b) => a.start - b.start);
}

const NOTATION_COMMENT_RE = /\s*(?:\/\/|#|--|;|%|<!--|\/\*)\s*\[!code[^\]]*\]\s*(?:-->|\*\/)?\s*$/;

/**
 * Strips `[!code ...]` notation from a copy payload: the transformer already
 * drops it from RENDERED output, but the raw `code` string would paste the
 * comment into someone's editor.
 */
export function stripNotationComments(code: string): string {
	return code
		.split("\n")
		.map((line) => line.replace(NOTATION_COMMENT_RE, ""))
		.join("\n");
}

/**
 * Plain, unhighlighted lines. One token per line, no colour.
 *
 * This is both the `highlight={false}` renderer and the first paint of a
 * streaming block, so the tail of a stream is readable before its grammar pass
 * lands and no frame is ever blank.
 */
export function toPlainLines(code: string, startLine = 1): CodeBlockLine[] {
	return normalizeCode(code)
		.split("\n")
		.map((text, index) => ({
			tokens: text ? [{ content: text }] : [],
			number: startLine + index,
			text,
		}));
}

/* -------------------------------------------------------------------------- */
/*                                  Markdown                                   */
/* -------------------------------------------------------------------------- */

/**
 * The slice of a React node tree `markdownCodeProps` reads: text, numbers,
 * arrays and elements (through their `className` and `children` props).
 * Anything else a `ReactNode` can hold contributes nothing.
 */
type MarkdownCodeNode = string | number | boolean | null | undefined | MarkdownCodeNode[] | MarkdownCodeElement;

interface MarkdownCodeElement {
	props: {
		className?: string | undefined;
		children?: MarkdownCodeNode | undefined;
	};
}

/**
 * Reads a react-markdown subtree back through zod rather than `typeof` probes
 * and casts. Tolerant by construction: an unreadable child (a symbol, a
 * promise, a non-string `className`) degrades to "contributes nothing"
 * instead of failing the whole parse, matching ReUI's walker.
 */
const MarkdownCodeNodeSchema: z.ZodType<MarkdownCodeNode> = z.lazy(() =>
	z
		.union([
			z.string(),
			z.number(),
			z.boolean(),
			z.null(),
			z.undefined(),
			z.array(MarkdownCodeNodeSchema),
			z.object({
				props: z.object({
					className: z.string().optional().catch(undefined),
					children: MarkdownCodeNodeSchema.optional(),
				}),
			}),
		])
		.catch(null),
);

const MARKDOWN_LANGUAGE_CLASS_RE = /(?:^|\s)language-(?<language>[\w+#-]+)/;
const MARKDOWN_TRAILING_NEWLINE_RE = /\n$/;

/** What react-markdown hands a `pre` override, as far as `markdownCodeProps` reads it. */
export interface MarkdownPreProps {
	children?: ReactNode;
	className?: string | undefined;
}

/** The `code` / `language` pair a `CodeBlock` takes, read from a markdown `pre`. */
export interface MarkdownCodeProps {
	code: string;
	language?: string | undefined;
}

/**
 * Pulls `code` and `language` out of the props react-markdown gives a `pre`:
 * the glue every AI chat app writes by hand, shipped here instead. Tolerant by
 * construction, because a still-streaming fence has no closing delimiter and
 * often no language yet, and must render as plain text rather than throw.
 */
export function markdownCodeProps(props: MarkdownPreProps): MarkdownCodeProps {
	let language: string | undefined;
	let code = "";

	const readClassName = (value: string | undefined): void => {
		if (value === undefined || language !== undefined) return;
		language = MARKDOWN_LANGUAGE_CLASS_RE.exec(value)?.groups?.language;
	};

	const walk = (node: MarkdownCodeNode): void => {
		if (node === null || node === undefined || node === false || node === true) return;
		if (isStringPrimitive(node)) {
			code += node;
			return;
		}
		if (isNumberPrimitive(node)) {
			code += String(node);
			return;
		}
		if (isArrayValue(node)) {
			for (const child of node) walk(child);
			return;
		}
		readClassName(node.props.className);
		walk(node.props.children);
	};

	readClassName(props.className);
	walk(MarkdownCodeNodeSchema.parse(props.children));

	return { code: code.replace(MARKDOWN_TRAILING_NEWLINE_RE, ""), language };
}

/** One segment of a markdown string: prose, or a fenced code block. */
export interface CodeBlockMarkdownPart {
	type: "text" | "code";
	content: string;
	language?: string | undefined;
	/** True for a fence whose closing delimiter has not arrived yet. */
	open: boolean;
}

/* CommonMark fences: three or more backticks OR tildes, then an optional
   info word. */
const MARKDOWN_FENCE_RE = /^\s*(?<delimiter>`{3,}|~{3,})(?<info>[\w+#-]*)\s*$/;

/**
 * Splits markdown into prose and fenced code, for transcripts that render a
 * raw assistant message without a markdown dependency. The unterminated
 * trailing fence is the point: mid-stream it comes back as a code part flagged
 * `open`, instead of being dropped or read as prose.
 */
export function markdownFences(markdown: string): CodeBlockMarkdownPart[] {
	const parts: CodeBlockMarkdownPart[] = [];

	let inFence = false;
	let opener = "";
	let language: string | undefined;
	let buffer: string[] = [];

	const flushText = (): void => {
		const text = buffer.join("\n").trim();
		if (text) parts.push({ type: "text", content: text, open: false });
		buffer = [];
	};

	const flushCode = (open: boolean): void => {
		parts.push({ type: "code", content: buffer.join("\n"), language, open });
		buffer = [];
		language = undefined;
	};

	for (const line of markdown.split("\n")) {
		const fence = MARKDOWN_FENCE_RE.exec(line);
		const delimiter = fence?.groups?.delimiter ?? "";
		const info = fence?.groups?.info ?? "";

		if (fence && !inFence) {
			flushText();
			inFence = true;
			opener = delimiter;
			language = info.length > 0 ? info : undefined;
			continue;
		}

		/* The closer must repeat the opener's character at least as many times,
		   or a ```` fence containing ``` examples would close three lines early. */
		if (fence && inFence && delimiter.startsWith(opener.charAt(0)) && delimiter.length >= opener.length && info.length === 0) {
			flushCode(false);
			inFence = false;
			continue;
		}

		buffer.push(line);
	}

	/* A fence still open at the end of the string is the streaming case: the
	   closing delimiter has not arrived. Reporting it as code with `open` set is
	   what lets a transcript render the partial block instead of dropping it. */
	if (inFence) flushCode(true);
	else flushText();

	return parts;
}

/* -------------------------------------------------------------------------- */
/*                                   Engine                                    */
/* -------------------------------------------------------------------------- */

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();
const loadedThemes = new Set<string>();

/**
 * One highlighter per page, on the JavaScript regex engine: oniguruma needs
 * WebAssembly, which forces `'wasm-unsafe-eval'` into every consumer's CSP.
 * `forgiving` keeps an inexpressible grammar pattern from taking the block
 * down.
 */
function loadHighlighter(): Promise<HighlighterCore> {
	highlighterPromise ??= (async (): Promise<HighlighterCore> => {
		const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);

		return createHighlighterCore({
			themes: [],
			langs: [],
			engine: createJavaScriptRegexEngine({ forgiving: true }),
		});
	})();

	return highlighterPromise;
}

/**
 * Themes register per name, on demand, exactly like languages.
 *
 * Baking the FIRST caller's pair into the singleton looks correct until a page
 * holds two blocks with different `themes` props: the second silently renders
 * in the first one's colours, because the singleton never learns about the
 * request. Loading by name makes every block's prop actually mean something.
 */
const warnedThemes = new Set<string>();

async function ensureTheme(highlighter: HighlighterCore, name: string, side: keyof CodeBlockThemes = "light"): Promise<string> {
	/* Falls back to the MATCHING side (an unknown dark theme used to fall back
	   to github-light, silently rendering light colours in dark mode). */
	const resolved = Object.hasOwn(codeBlockThemes, name) ? name : DEFAULT_CODE_BLOCK_THEMES[side];
	if (resolved !== name && process.env.NODE_ENV !== "production" && !warnedThemes.has(name)) {
		warnedThemes.add(name);
		console.warn(`[code-block] Unknown theme "${name}" - falling back to "${resolved}". ` + "Register it in codeBlockThemes to use it.");
	}
	if (loadedThemes.has(resolved)) return resolved;
	const loader = ownValue(codeBlockThemes, resolved);
	if (!loader) throw new Error(`[code-block] Theme "${resolved}" is not registered.`);
	await highlighter.loadTheme(await loader());
	loadedThemes.add(resolved);
	return resolved;
}

async function ensureLanguage(highlighter: HighlighterCore, language: string): Promise<void> {
	if (loadedLanguages.has(language)) return;
	const loader = ownValue(codeBlockLanguages, language);
	if (!loader) return;
	await highlighter.loadLanguage(await loader());
	loadedLanguages.add(language);
}

/* -------------------------------------------------------------------------- */
/*                            hast to normalised lines                         */
/* -------------------------------------------------------------------------- */

type CodeBlockTokenStyle = Omit<CodeBlockToken, "content">;

const FONT_STYLE_BY_DECLARATION: Record<string, CodeBlockFontStyle> = {
	"font-style:italic": "italic",
	"font-weight:bold": "bold",
	"text-decoration:underline": "underline",
};

/** Splits shiki's inline `style` string into the fields a token carries. */
function readTokenStyle(style: Properties[string]): CodeBlockTokenStyle {
	if (!isStringPrimitive(style)) return {};

	const out: CodeBlockTokenStyle = {};
	for (const declaration of style.split(";")) {
		const trimmed = declaration.trim();
		if (!trimmed) continue;

		const separator = trimmed.indexOf(":");
		if (separator === -1) continue;

		const property = trimmed.slice(0, separator).trim();
		const value = trimmed.slice(separator + 1).trim();

		if (property === "color") out.color = value;
		else if (property === "--shiki-dark") out.colorDark = value;
		else {
			const fontStyle = ownValue(FONT_STYLE_BY_DECLARATION, `${property}:${value}`);
			if (fontStyle) out.fontStyle = fontStyle;
		}
	}
	return out;
}

/**
 * shiki emits raw `class` (string or array), not hast's `className`; reading
 * only `className` finds nothing, which looks like a transformer that never
 * ran.
 */
function classListOf(node: Element): string[] {
	const value = node.properties.class ?? node.properties.className;
	if (isArrayValue(value)) return value.map(String);
	if (isStringPrimitive(value)) return value.split(/\s+/).filter(Boolean);
	return [];
}

/** Maps the classes shiki transformers put on a line onto line state. */
function stateFromClasses(classes: string[]): CodeBlockLineState | undefined {
	const state: CodeBlockLineState = {};
	if (classes.includes("highlighted")) state.highlighted = true;
	if (classes.includes("focused")) state.focused = true;
	if (classes.includes("diff")) {
		if (classes.includes("add")) state.diff = "add";
		else if (classes.includes("remove")) state.diff = "remove";
	}
	for (const level of CODE_BLOCK_LEVELS) {
		if (classes.includes(level)) state.level = level;
	}
	return Object.keys(state).length ? state : undefined;
}

function textOf(node: ElementContent): string {
	return node.type === "text" ? node.value : "";
}

function collectTokens(node: Element, out: CodeBlockToken[], inWord: boolean): void {
	for (const child of node.children) {
		if (child.type === "text") {
			if (!child.value) continue;
			out.push(inWord ? { content: child.value, word: true } : { content: child.value });
			continue;
		}
		if (child.type !== "element") continue;

		const classes = classListOf(child);
		const childInWord = inWord || classes.includes("cb-word");
		const style = readTokenStyle(child.properties.style);
		const hasStyle = Boolean(style.color ?? style.colorDark ?? style.fontStyle);

		/* A styled leaf is a token; a wrapper (a decoration span) is descended into
		   so its own children keep their individual colours. */
		const onlyText = child.children.every((grandChild) => grandChild.type === "text");

		if (hasStyle && onlyText) {
			const content = child.children.map(textOf).join("");
			if (!content) continue;
			out.push({
				content,
				...style,
				...(childInWord ? { word: true } : {}),
			});
			continue;
		}

		collectTokens(child, out, childInWord);
	}
}

function findCodeElement(root: Root | Element): Element | undefined {
	if (root.type === "element" && root.tagName === "code") return root;
	for (const child of root.children) {
		if (child.type !== "element") continue;
		const found = findCodeElement(child);
		if (found) return found;
	}
	return undefined;
}

/* -------------------------------------------------------------------------- */
/*                              Identity reuse                                 */
/* -------------------------------------------------------------------------- */

const MAX_TRACKED_DOCUMENTS = 24;

/**
 * Previous result per option signature, so a growing stream can reuse lines.
 * Keyed WITH the caller's instanceKey: without it, two same-configured blocks
 * evicted each other's entry on every interleaved pass. Bounded above because
 * module state outlives requests on the server.
 */
const previousDocuments = new Map<string, CodeBlockLine[]>();

function sameToken(left: CodeBlockToken, right: CodeBlockToken): boolean {
	return left.content === right.content && left.color === right.color && left.colorDark === right.colorDark && left.fontStyle === right.fontStyle && left.word === right.word;
}

function sameLine(a: CodeBlockLine, b: CodeBlockLine): boolean {
	if (a.number !== b.number || a.text !== b.text) return false;
	if (a.tokens.length !== b.tokens.length) return false;
	if (JSON.stringify(a.state ?? null) !== JSON.stringify(b.state ?? null)) {
		return false;
	}
	return a.tokens.every((left, index) => {
		const right = b.tokens[index];
		return right !== undefined && sameToken(left, right);
	});
}

/**
 * Swaps freshly built lines for the previous pass's objects where nothing
 * changed. This is why streaming is cheap: the row is a reference-equality
 * `memo`, so without this, appending one token to a 400 line file re-renders
 * 400 subtrees per chunk.
 */
function reuseUnchangedLines(key: string, next: CodeBlockLine[]): CodeBlockLine[] {
	const previous = previousDocuments.get(key);

	const reused = previous
		? next.map((line, index) => {
				const before = previous[index];
				return before && sameLine(before, line) ? before : line;
			})
		: next;

	previousDocuments.set(key, reused);
	if (previousDocuments.size > MAX_TRACKED_DOCUMENTS) {
		const oldest = previousDocuments.keys().next().value;
		if (oldest !== undefined) previousDocuments.delete(oldest);
	}

	return reused;
}

/* -------------------------------------------------------------------------- */
/*                                highlightCode                                */
/* -------------------------------------------------------------------------- */

function applyPropState(lines: CodeBlockLine[], options: CodeBlockHighlightOptions): void {
	const highlighted = parseLineSpec(options.highlightedLines);
	const focused = parseLineSpec(options.focusedLines);
	const added = parseLineSpec(options.diff?.added);
	const removed = parseLineSpec(options.diff?.removed);
	const levels: Record<CodeBlockLevel, Set<number>> = {
		error: parseLineSpec(options.lineLevels?.error),
		warning: parseLineSpec(options.lineLevels?.warning),
		info: parseLineSpec(options.lineLevels?.info),
	};

	lines.forEach((line, index) => {
		const source = index + 1;
		const state: CodeBlockLineState = { ...line.state };

		if (highlighted.has(source)) state.highlighted = true;
		if (focused.has(source)) state.focused = true;
		if (added.has(source)) state.diff = "add";
		else if (removed.has(source)) state.diff = "remove";
		for (const level of CODE_BLOCK_LEVELS) {
			if (levels[level].has(source)) state.level = level;
		}

		line.state = Object.keys(state).length ? state : undefined;
	});
}

/**
 * Highlights `code` into the renderer's line shape. Built on `codeToHast` so
 * consumer transformers run and their line classes land in `line.state`,
 * making prop state and `[!code ++]` notation one feature, not two code
 * paths. Safe in a server component: the result is plain JSON.
 */
export async function highlightCode(code: string, options: CodeBlockHighlightOptions = {}): Promise<CodeBlockLine[]> {
	const source = normalizeCode(code);
	const startLine = options.startLine ?? 1;
	const language = resolveCodeBlockLanguage(options.language);

	if (!language) return toPlainLines(source, startLine);

	const themes = options.themes ?? DEFAULT_CODE_BLOCK_THEMES;
	const signature = JSON.stringify([
		options.instanceKey ?? null,
		language,
		themes,
		startLine,
		options.highlightedLines ?? null,
		options.highlightedWords ?? null,
		options.focusedLines ?? null,
		options.diff ?? null,
		options.lineLevels ?? null,
		(options.transformers ?? []).length,
	]);

	let root: Root;
	try {
		const highlighter = await loadHighlighter();
		const [light, dark] = await Promise.all([ensureTheme(highlighter, themes.light, "light"), ensureTheme(highlighter, themes.dark, "dark")]);
		await ensureLanguage(highlighter, language);

		root = highlighter.codeToHast(source, {
			lang: language,
			themes: { light, dark },
			defaultColor: "light",
			cssVariablePrefix: "--shiki-",
			decorations: buildWordDecorations(source, options.highlightedWords),
			...(options.transformers?.length ? { transformers: options.transformers } : {}),
		});
	} catch {
		/* A missing grammar, an unloadable theme or a transformer throwing must not
		   take the surface down. Plain text is always readable. */
		return toPlainLines(source, startLine);
	}

	const codeElement = findCodeElement(root);
	if (!codeElement) return toPlainLines(source, startLine);

	const lines: CodeBlockLine[] = [];
	for (const child of codeElement.children) {
		if (child.type !== "element") continue;
		const tokens: CodeBlockToken[] = [];
		collectTokens(child, tokens, false);
		lines.push({
			tokens,
			number: startLine + lines.length,
			text: tokens.map((token) => token.content).join(""),
			state: stateFromClasses(classListOf(child)),
		});
	}

	if (!lines.length) return toPlainLines(source, startLine);

	applyPropState(lines, options);
	return reuseUnchangedLines(signature, lines);
}

export interface CodeBlockPreloadOptions {
	/** Grammars to load (any spelling `resolveCodeBlockLanguage` accepts). Defaults to every registered language. */
	readonly languages?: readonly string[];
	readonly themes?: CodeBlockThemes;
}

/**
 * Loads the engine, a theme pair and grammars ahead of time.
 *
 * Needed wherever lazy `import()` stops working after startup: a build tool
 * that loads its config through a module runner and closes it (Astro/Vite)
 * would otherwise make every later `highlightCode` fall back to plain text.
 * Also useful to take the first-highlight latency off a server's hot path.
 */
export async function preloadCodeBlockHighlighter(options: CodeBlockPreloadOptions = {}): Promise<void> {
	const highlighter = await loadHighlighter();
	const themes = options.themes ?? DEFAULT_CODE_BLOCK_THEMES;
	await Promise.all([ensureTheme(highlighter, themes.light, "light"), ensureTheme(highlighter, themes.dark, "dark")]);
	const languages = options.languages ?? Object.keys(codeBlockLanguages);
	for (const language of languages) {
		const resolved = resolveCodeBlockLanguage(language);
		if (resolved !== undefined) {
			await ensureLanguage(highlighter, resolved);
		}
	}
}

/** Test seam: drops the singleton and every cached document. */
export function resetCodeBlockHighlighter(): void {
	highlighterPromise = null;
	loadedLanguages.clear();
	loadedThemes.clear();
	previousDocuments.clear();
}
