// Title: Code Block Highlight
// Description: Isomorphic shiki engine and pure helpers for the code block.
// Ported from ReUI (https://reui.io/r/code-block.json). Every feature of the
// original is kept; the deviations are type-level only (no casts, no `unknown`,
// real shiki/hast types) and are listed in packages/ui/README.md.

/**
 * No "use client" directive, deliberately: a server component awaits
 * `highlightCode` and passes `lines` down, costing the client nothing. The
 * contract test asserts the directive stays absent. shiki loads lazily inside
 * `loadHighlighter`, so importing a helper from here bundles no engine.
 */

import type { Element, ElementContent, Properties, Root } from "hast";
import { isValidElement, type ReactNode } from "react";
import type { DecorationItem, HighlighterCore, LanguageInput, ShikiTransformer, ThemeInput } from "shiki";

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

const LINE_RANGE_RE = /^(\d+)\s*-\s*(\d+)$/;
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

	if (Array.isArray(spec)) {
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
			const start = Number(range[1]);
			const end = Number(range[2]);
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
		const word = typeof entry === "string" ? entry : entry.word;
		if (!word) continue;
		const limit = typeof entry === "string" ? undefined : parseLineSpec(entry.lines);

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

/** The props react-markdown hands a `pre`/`code` element. */
export interface CodeBlockMarkdownElementProps {
	children?: ReactNode;
	className?: string;
}

const MARKDOWN_LANGUAGE_CLASS_RE = /(?:^|\s)language-([\w+#-]+)/;

/**
 * Pulls `code` and `language` out of the props react-markdown gives a `pre`:
 * the glue every AI chat app writes by hand, shipped here instead. Tolerant by
 * construction, because a still-streaming fence has no closing delimiter and
 * often no language yet, and must render as plain text rather than throw.
 */
export function markdownCodeProps(props: CodeBlockMarkdownElementProps): { code: string; language?: string | undefined } {
	let language: string | undefined;
	let code = "";

	const readClassName = (value: string | undefined): void => {
		if (value === undefined) return;
		const match = MARKDOWN_LANGUAGE_CLASS_RE.exec(value);
		if (match && !language) language = match[1];
	};

	const walk = (node: ReactNode): void => {
		if (node === null || node === undefined || typeof node === "boolean") return;
		if (typeof node === "string") {
			code += node;
			return;
		}
		if (typeof node === "number" || typeof node === "bigint") {
			code += String(node);
			return;
		}
		/* An element: react-markdown nests the `code` element (and its className)
		   inside the `pre`, so read its props and keep descending. */
		if (isValidElement<CodeBlockMarkdownElementProps>(node)) {
			/* A className is a string by the element contract; anything else
			   (a malformed plugin output) is ignored rather than trusted. */
			const className = node.props.className;
			readClassName(typeof className === "string" ? className : undefined);
			walk(node.props.children);
			return;
		}
		/* Arrays and other iterables of children. A pending Promise (an async
		   server child) has no text yet and contributes nothing. */
		if (Symbol.iterator in node) {
			for (const child of node) walk(child);
		}
	};

	readClassName(props.className);
	walk(props.children);

	return { code: code.replace(/\n$/, ""), language };
}

/** One segment of a markdown string: prose, or a fenced code block. */
export interface CodeBlockMarkdownPart {
	type: "text" | "code";
	content: string;
	language?: string | undefined;
	/** True for a fence whose closing delimiter has not arrived yet. */
	open: boolean;
}

const MARKDOWN_FENCE_RE = /^\s*(`{3,}|~{3,})([\w+#-]*)\s*$/;

/**
 * Splits markdown into prose and fenced code, for transcripts that render a
 * raw assistant message without a markdown dependency. The unterminated
 * trailing fence is the point: mid-stream it comes back as a code part flagged
 * `open`, instead of being dropped or read as prose.
 */
export function markdownFences(markdown: string): CodeBlockMarkdownPart[] {
	const parts: CodeBlockMarkdownPart[] = [];
	const lines = markdown.split("\n");

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
		parts.push({
			type: "code",
			content: buffer.join("\n"),
			language,
			open,
		});
		buffer = [];
		language = undefined;
	};

	for (const line of lines) {
		/* CommonMark fences: three or more backticks OR tildes. The closer must
		   repeat the opener's character at least as many times, or a \`\`\`\`
		   fence containing \`\`\` examples would close three lines early. */
		const fence = MARKDOWN_FENCE_RE.exec(line);
		const delimiter = fence?.[1] ?? "";
		const info = fence?.[2] ?? "";

		if (fence && !inFence) {
			flushText();
			inFence = true;
			opener = delimiter;
			language = info.length > 0 ? info : undefined;
			continue;
		}

		if (fence && inFence && delimiter.startsWith(opener.charAt(0)) && delimiter.length >= opener.length && !info) {
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
	if (typeof style !== "string") return {};

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
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
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

/* -------------------------------------------------------------------------- */
/*                                    ANSI                                     */
/* -------------------------------------------------------------------------- */

/**
 * The 16 SGR slots as CSS variables with readable defaults per theme, so a
 * consumer retints terminal output next to their other design tokens
 * (`--code-ansi-red`, `--code-ansi-bright-blue`, ...). 256-colour and
 * truecolor sequences bypass the palette and emit their literal colour.
 */
interface AnsiSlot {
	readonly name: string;
	readonly light: string;
	readonly dark: string;
}

const ANSI_PALETTE: readonly AnsiSlot[] = [
	{ name: "black", light: "#3f3f46", dark: "#a1a1aa" },
	{ name: "red", light: "#dc2626", dark: "#f87171" },
	{ name: "green", light: "#16a34a", dark: "#4ade80" },
	{ name: "yellow", light: "#a16207", dark: "#facc15" },
	{ name: "blue", light: "#2563eb", dark: "#60a5fa" },
	{ name: "magenta", light: "#9333ea", dark: "#c084fc" },
	{ name: "cyan", light: "#0891b2", dark: "#22d3ee" },
	{ name: "white", light: "#71717a", dark: "#e4e4e7" },
	{ name: "bright-black", light: "#52525b", dark: "#71717a" },
	{ name: "bright-red", light: "#ef4444", dark: "#fca5a5" },
	{ name: "bright-green", light: "#22c55e", dark: "#86efac" },
	{ name: "bright-yellow", light: "#ca8a04", dark: "#fde047" },
	{ name: "bright-blue", light: "#3b82f6", dark: "#93c5fd" },
	{ name: "bright-magenta", light: "#a855f7", dark: "#d8b4fe" },
	{ name: "bright-cyan", light: "#06b6d4", dark: "#67e8f9" },
	{ name: "bright-white", light: "#a1a1aa", dark: "#fafafa" },
];

/* SGR parameter numbers (ECMA-48). Named so the dispatch below reads as the
   spec does rather than as a wall of integers. */
const SGR_RESET = 0;
const SGR_BOLD = 1;
const SGR_ITALIC = 3;
const SGR_UNDERLINE = 4;
const SGR_NOT_BOLD = 22;
const SGR_NOT_ITALIC = 23;
const SGR_NOT_UNDERLINE = 24;
const SGR_FOREGROUND_FIRST = 30;
const SGR_FOREGROUND_LAST = 37;
const SGR_FOREGROUND_EXTENDED = 38;
const SGR_FOREGROUND_DEFAULT = 39;
const SGR_BACKGROUND_EXTENDED = 48;
const SGR_BRIGHT_FOREGROUND_FIRST = 90;
const SGR_BRIGHT_FOREGROUND_LAST = 97;
/** Offset from a bright SGR code (90-97) to its palette slot (8-15). */
const SGR_BRIGHT_SLOT_OFFSET = 82;
/** `38;5;n`: an xterm 256-colour index follows. */
const SGR_EXTENDED_256 = 5;
/** `38;2;r;g;b`: a truecolor triple follows. */
const SGR_EXTENDED_RGB = 2;
/** Parameters consumed after `38;5` / `38;2`. */
const SGR_256_ARGUMENTS = 2;
const SGR_RGB_ARGUMENTS = 4;

/* xterm 256-colour layout: 16 system colours, a 6x6x6 cube, then 24 greys. */
const XTERM_SYSTEM_COLORS = 16;
const XTERM_GREYSCALE_FIRST = 232;
const XTERM_GREYSCALE_BASE = 8;
const XTERM_GREYSCALE_STEP = 10;
const XTERM_CUBE_SIDE = 6;
const XTERM_CUBE_LEVELS: readonly number[] = [0, 95, 135, 175, 215, 255];
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

function hexByte(value: number): string {
	return value.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0");
}

function ansiVar(slot: AnsiSlot, fallback: string): string {
	return `var(--code-ansi-${slot.name}, ${fallback})`;
}

/** xterm 256-colour index to hex, computed rather than tabled. */
function ansi256(index: number): string {
	if (index < XTERM_SYSTEM_COLORS) return ANSI_PALETTE[index]?.dark ?? "";
	if (index >= XTERM_GREYSCALE_FIRST) {
		const h = hexByte(XTERM_GREYSCALE_BASE + (index - XTERM_GREYSCALE_FIRST) * XTERM_GREYSCALE_STEP);
		return `#${h}${h}${h}`;
	}
	const n = index - XTERM_SYSTEM_COLORS;
	const to = (v: number): string => hexByte(XTERM_CUBE_LEVELS[v] ?? 0);
	const side = XTERM_CUBE_SIDE;
	return `#${to(Math.floor(n / (side * side)))}${to(Math.floor(n / side) % side)}${to(n % side)}`;
}

/* The escape bytes are built from their code points rather than written into a
   regex literal: `no-control-regex` rejects a literal ESC/BEL, and this is the
   one place in the kit that has to match them on purpose. */
const ESCAPE = String.fromCharCode(0x1b);
const BELL = String.fromCharCode(0x07);

const SGR_RE = new RegExp(`${ESCAPE}\\[([0-9;]*)m`, "g");
/* Everything except SGR (the trailing `m`), which the tokenizer consumes -
   this regex once matched SGR too and silently stripped every colour. */
const OTHER_ESCAPES_RE = new RegExp(`${ESCAPE}(?:\\[(?![0-9;]*m)[0-9;?]*[A-Za-z]|\\][^${BELL}]*(?:${BELL}|${ESCAPE}\\\\)|[()][0-9A-B])`, "g");

interface AnsiStyle {
	color?: string;
	colorDark?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
}

function ansiFontStyle(style: AnsiStyle): CodeBlockFontStyle | undefined {
	if (style.bold) return "bold";
	if (style.italic) return "italic";
	if (style.underline) return "underline";
	return undefined;
}

function setPaletteColor(style: AnsiStyle, slotIndex: number): void {
	const slot = ANSI_PALETTE[slotIndex];
	if (!slot) return;
	style.color = ansiVar(slot, slot.light);
	style.colorDark = ansiVar(slot, slot.dark);
}

/**
 * Applies one SGR parameter list to the running style. Returns nothing; the
 * style object is the tokenizer's running state.
 */
function applySgr(style: AnsiStyle, params: number[]): void {
	for (let i = 0; i < params.length; i += 1) {
		const code = params[i];
		if (code === undefined) continue;
		if (code === SGR_RESET) {
			delete style.color;
			delete style.colorDark;
			style.bold = false;
			style.italic = false;
			style.underline = false;
		} else if (code === SGR_BOLD) style.bold = true;
		else if (code === SGR_ITALIC) style.italic = true;
		else if (code === SGR_UNDERLINE) style.underline = true;
		else if (code === SGR_NOT_BOLD) style.bold = false;
		else if (code === SGR_NOT_ITALIC) style.italic = false;
		else if (code === SGR_NOT_UNDERLINE) style.underline = false;
		else if (code === SGR_FOREGROUND_DEFAULT) {
			delete style.color;
			delete style.colorDark;
		} else if (code >= SGR_FOREGROUND_FIRST && code <= SGR_FOREGROUND_LAST) {
			setPaletteColor(style, code - SGR_FOREGROUND_FIRST);
		} else if (code >= SGR_BRIGHT_FOREGROUND_FIRST && code <= SGR_BRIGHT_FOREGROUND_LAST) {
			setPaletteColor(style, code - SGR_BRIGHT_SLOT_OFFSET);
		} else if (code === SGR_FOREGROUND_EXTENDED && params[i + 1] === SGR_EXTENDED_256) {
			const hex = ansi256(params[i + 2] ?? 0);
			style.color = hex;
			style.colorDark = hex;
			i += SGR_256_ARGUMENTS;
		} else if (code === SGR_FOREGROUND_EXTENDED && params[i + 1] === SGR_EXTENDED_RGB) {
			const rgb = [params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0];
			const hex = `#${rgb.map(hexByte).join("")}`;
			style.color = hex;
			style.colorDark = hex;
			i += SGR_RGB_ARGUMENTS;
		} else if (code === SGR_BACKGROUND_EXTENDED && (params[i + 1] === SGR_EXTENDED_256 || params[i + 1] === SGR_EXTENDED_RGB)) {
			i += params[i + 1] === SGR_EXTENDED_256 ? SGR_256_ARGUMENTS : SGR_RGB_ARGUMENTS;
		}
		/* 40-47 / 100-107 backgrounds: consumed by falling through. */
	}
}

/**
 * Terminal output with SGR colour codes, as renderable lines: feed the result
 * to the `lines` prop. Covers what agent stdout actually uses - 30-37 / 90-97
 * foregrounds, 38;5;n and 38;2;r;g;b, bold, italic, underline and resets.
 * Backgrounds and cursor movements are STRIPPED rather than rendered: a code
 * surface has its own background, and a partial screen-drawing stream is
 * better read as text than half-drawn.
 */
export function ansiToLines(text: string, startLine = 1): CodeBlockLine[] {
	const clean = normalizeCode(text).replace(OTHER_ESCAPES_RE, "");

	return clean.split("\n").map((raw, index) => {
		const tokens: CodeBlockToken[] = [];
		const style: AnsiStyle = {};
		let plain = "";
		let last = 0;

		const flush = (content: string): void => {
			if (!content) return;
			tokens.push({
				content,
				color: style.color,
				colorDark: style.colorDark,
				fontStyle: ansiFontStyle(style),
			});
		};

		for (const match of raw.matchAll(SGR_RE)) {
			flush(raw.slice(last, match.index));
			plain += raw.slice(last, match.index);
			last = match.index + match[0].length;

			const parameters = match[1] ?? "";
			applySgr(style, (parameters.length > 0 ? parameters : String(SGR_RESET)).split(";").map(Number));
		}
		flush(raw.slice(last));
		plain += raw.slice(last);

		return { number: startLine + index, text: plain, tokens };
	});
}

/* -------------------------------------------------------------------------- */
/*                                Unified diff                                 */
/* -------------------------------------------------------------------------- */

export interface CodeBlockPatchFile {
	/** New-side path, or the old one for a deletion. */
	file: string;
	/** Unified view: context, removed and added lines with dual gutter labels. */
	lines: CodeBlockLine[];
	added: number;
	removed: number;
	hunks: { header: string; at: number }[];
}

const DIFF_GIT_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const DIFF_PLUS_HEADER_RE = /^\+\+\+ (?:b\/)?(.+)$/;
const DIFF_METADATA_RE = /^(---|index |old mode|new mode|new file|deleted file|similarity|rename |Binary )/;
const DIFF_HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
/** Narrowest gutter column, so single-digit hunks do not twitch the layout. */
const DIFF_MIN_GUTTER_WIDTH = 2;
const DIFF_DEFAULT_GUTTER_WIDTH = 4;

/**
 * A `git diff` / unified patch, as renderable per-file line sets: feed each
 * file's `lines` to the `lines` prop and the diff tints, `+`/`-` glyphs and
 * dual old/new gutter numbers all come from the parse - no `diff` prop
 * arithmetic against a hand-concatenated string. Tokens are plain; patches
 * read by tint, not grammar.
 */
export function parseUnifiedDiff(patch: string): CodeBlockPatchFile[] {
	const files: CodeBlockPatchFile[] = [];
	let oldNumber = 0;
	let newNumber = 0;
	let width = DIFF_DEFAULT_GUTTER_WIDTH;

	const push = (file: CodeBlockPatchFile, text: string, state: CodeBlockLineState | undefined, gutter: string): void => {
		file.lines.push({
			number: file.lines.length + 1,
			text,
			tokens: [{ content: text }],
			state,
			gutter,
		});
	};
	const pad = (value: number | null): string => (value === null ? "" : String(value)).padStart(width);

	for (const raw of normalizeCode(patch).split("\n")) {
		/* The file being filled is always the last one opened. */
		const current = files.at(-1);
		const fileHeader = DIFF_GIT_HEADER_RE.exec(raw);
		const plusHeader = DIFF_PLUS_HEADER_RE.exec(raw);
		const name = fileHeader ? fileHeader[2] : plusHeader?.[1];
		if (name !== undefined) {
			if (name !== "/dev/null" && current?.file !== name) {
				files.push({ file: name, lines: [], added: 0, removed: 0, hunks: [] });
			}
			continue;
		}
		if (DIFF_METADATA_RE.test(raw)) {
			continue;
		}

		const hunk = DIFF_HUNK_RE.exec(raw);
		if (hunk && current) {
			oldNumber = Number(hunk[1]);
			newNumber = Number(hunk[3]);
			width = Math.max(String(oldNumber + Number(hunk[2] ?? 0)).length, String(newNumber + Number(hunk[4] ?? 0)).length, DIFF_MIN_GUTTER_WIDTH);
			current.hunks.push({ header: raw, at: current.lines.length + 1 });
			const context = (hunk[5] ?? "").trim();
			push(current, context.length > 0 ? context : raw, { level: "info" }, `${"·".padStart(width)} ${"·".padStart(width)}`);
			continue;
		}
		if (!current || (!raw && files.length === 0)) continue;

		if (raw.startsWith("+")) {
			push(current, raw.slice(1), { diff: "add" }, `${pad(null)} ${pad(newNumber)}`);
			newNumber += 1;
			current.added += 1;
		} else if (raw.startsWith("-")) {
			push(current, raw.slice(1), { diff: "remove" }, `${pad(oldNumber)} ${pad(null)}`);
			oldNumber += 1;
			current.removed += 1;
		} else if (raw.startsWith(" ") || raw === "") {
			if (current.lines.length === 0 && raw === "") continue;
			push(current, raw.slice(1), undefined, `${pad(oldNumber)} ${pad(newNumber)}`);
			oldNumber += 1;
			newNumber += 1;
		}
	}

	return files;
}
