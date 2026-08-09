"use client";

import { Check, Copy, Download, WrapText } from "lucide-react";
import * as React from "react";
import type { BundledLanguage, BundledTheme, Highlighter, ShikiTransformer } from "shiki";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { CodeLanguage } from "@/lib/docs/code-block";

/**
 * CodeBlock — a polished, shiki-powered code viewer used by the markdown
 * renderer. Dumb and presentational: it receives the code + language via props
 * and renders a header bar (language label, optional download, word-wrap
 * toggle, copy button) and the highlighted body (optional line-number gutter).
 * The shiki highlighter is created once and shared (module-level promise).
 *
 * Extra reading features on top of highlighting:
 * - `highlightLines` tints 1-based line numbers (shiki v4 transformer — the
 *   `line()` hook adds a `highlight-line` class, styled via Tailwind
 *   arbitrary variants on the body wrapper).
 * - `diff` language renders GitHub-style (`+` green, `-` red, `@@` blue)
 *   with pure CSS — no shiki grammar needed.
 * - Word-wrap toggle (`aria-pressed`), collapse for blocks over
 *   `MAX_COLLAPSED_LINES`, and a copy toast that names the file/language.
 */

/**
 * Per-language accent colors for the header bar — a colored dot + colored
 * label so the block's language is identifiable at a glance. The block surface
 * is ALWAYS the One Dark Pro dark editor background (in both app themes), so
 * labels use the light-tail variants unconditionally — a `dark:`-only variant
 * would vanish in light app mode.
 */
const LANG_COLORS: Readonly<Record<CodeLanguage, { readonly dot: string; readonly label: string }>> = {
	bash: { dot: "bg-emerald-400", label: "text-emerald-400" },
	typescript: { dot: "bg-blue-400", label: "text-blue-400" },
	ts: { dot: "bg-blue-400", label: "text-blue-400" },
	tsx: { dot: "bg-sky-400", label: "text-sky-400" },
	js: { dot: "bg-yellow-400", label: "text-yellow-400" },
	jsx: { dot: "bg-amber-400", label: "text-amber-400" },
	json: { dot: "bg-yellow-400", label: "text-yellow-400" },
	sql: { dot: "bg-sky-400", label: "text-sky-400" },
	prisma: { dot: "bg-teal-400", label: "text-teal-400" },
	env: { dot: "bg-orange-400", label: "text-orange-400" },
	css: { dot: "bg-violet-400", label: "text-violet-400" },
	html: { dot: "bg-orange-400", label: "text-orange-400" },
	yaml: { dot: "bg-slate-400", label: "text-slate-400" },
	ini: { dot: "bg-slate-400", label: "text-slate-400" },
	markdown: { dot: "bg-gray-400", label: "text-gray-400" },
	http: { dot: "bg-green-400", label: "text-green-400" },
	diff: { dot: "bg-orange-400", label: "text-orange-400" },
	plaintext: { dot: "bg-slate-500", label: "text-slate-400" },
};

/**
 * Maps app-level language names to shiki's bundled language ids. `plaintext`
 * is intentionally absent — shiki v4 has no plaintext grammar, so those blocks
 * render unhighlighted instead. `diff` is also absent: diffs render through a
 * dedicated pure-CSS path (GitHub-style +/-/@@ colors), not a shiki grammar.
 */
const SHIKI_LANG: Readonly<Partial<Record<CodeLanguage, BundledLanguage>>> = {
	bash: "bash",
	typescript: "typescript",
	ts: "typescript",
	tsx: "tsx",
	js: "javascript",
	jsx: "jsx",
	json: "json",
	sql: "sql",
	prisma: "prisma",
	env: "ini",
	css: "css",
	html: "html",
	yaml: "yaml",
	ini: "ini",
	markdown: "markdown",
	http: "http",
};

// The single code-block theme: One Dark Pro — the classic Atom palette
// (vibrant blue/orange/green on deep slate #282c34) shown in BOTH light and
// dark app modes, exactly like VS Code always using the same editor colors.
const THEME: BundledTheme = "one-dark-pro";

// One Dark Pro's editor background — the block surface stays dark in both app
// themes so the pale token palette always has its intended contrast.
const THEME_BG = "#282c34";

// Blocks longer than this collapse behind a "Show all N lines" affordance.
const MAX_COLLAPSED_LINES = 30;

// The class the line-highlight transformer stamps on highlighted lines. The
// visual (full-width tint + left accent) lives on the body wrapper's Tailwind
// arbitrary variants (`[&_.highlight-line]:…`) so the feature is
// self-contained in the component.
const HIGHLIGHT_CLASS = "highlight-line";

/** Shared empty highlight list — a stable identity keeps the effect deps stable. */
const NO_HIGHLIGHTS: readonly number[] = [];

let highlighterPromise: Promise<Highlighter> | undefined;

/**
 * Lazily loads the shiki highlighter. `shiki` (~300 KB) is a runtime
 * `import()` — the type-only import above is erased at build time, so the
 * shiki chunk is NOT part of the docs page bundle. It only downloads when the
 * first code block mounts, and the component renders the plain `<pre>` code
 * until the highlight finishes (the docs body is readable immediately, then
 * colors slide in). The highlighter is created once and shared.
 */
function getHighlighter(): Promise<Highlighter> {
	highlighterPromise ??= (async (): Promise<Highlighter> => {
		try {
			const { createHighlighter } = await import("shiki");
			return await createHighlighter({
				themes: [THEME],
				langs: [...new Set(Object.values(SHIKI_LANG))],
			});
		} catch (error) {
			// A failed network load must not poison the page for its whole
			// lifetime: reset the promise so a LATER code block retries.
			highlighterPromise = undefined;
			throw error;
		}
	})();
	return highlighterPromise;
}

/**
 * Shiki v4 transformer that (a) strips the literal `\n` text nodes shiki
 * drops between line spans — with `display: block` lines those become phantom
 * 17px rows that desync the number gutter — and (b) stamps `highlight-line`
 * on the given 1-based line numbers (the `line()` hook runs per rendered line
 * span with a 0-based index). Applied unconditionally so the `\n` cleanup
 * always happens, even for blocks with no highlights.
 */
function codeBlockTransformer(highlightLines: ReadonlySet<number>): ShikiTransformer {
	return {
		code(hast): void {
			hast.children = hast.children.filter((child): boolean => !(child.type === "text" && child.value.trim().length === 0));
		},
		line(hast, line): void {
			if (highlightLines.has(line + 1)) {
				this.addClassToHast(hast, HIGHLIGHT_CLASS);
			}
		},
	};
}

/**
 * Cheap heuristic used only when the fence tag is missing (the docs always tag
 * their fences, but prose-as-code fences and copy-paste can leave them bare).
 * Returns a `CodeLanguage` so a best-effort color pass can run; returns
 * `"plaintext"` when nothing matches (ASCII trees/diagrams stay uncolored).
 */
export function detectLanguageName(code: string): CodeLanguage {
	const trimmed = code.trim();
	const firstLine = trimmed.split("\n")[0] ?? "";

	// .env content — `KEY=value` pairs. Must run BEFORE the JSON check, because
	// a bare `DATABASE_URL="postgresql://..."` line would otherwise look like a
	// string-bearing object to the JSON test below.
	if (/^[A-Z][A-Z0-9_]*=/.test(firstLine)) {
		return "env";
	}

	// Unified diffs — `diff --git`, `--- a/`, `+++ b/`, or a `@@ hunk` header.
	// A standalone `+`/`-` first line is NOT enough (bash flags like `-f` and
	// `--recursive` would false-positive) — the block must OPEN like a diff.
	if (/^(?:diff --git|--- a\/|\+\+\+ b\/|@@)/.test(trimmed)) {
		return "diff";
	}

	// HTTP request/response blocks — `METHOD path HTTP/1.1` or a leading
	// `HTTP/1.1 <status>` status line, with `Header: value` lines.
	if (/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+HTTP\/\d/.test(firstLine) || /^HTTP\/\d\.\d\s+\d{3}/.test(firstLine)) {
		return "http";
	}

	// Shell commands — a `$` prompt or a leading command keyword followed by a
	// space/EOL. Requiring the separator keeps directory listings
	// (`node_modules/`), prose starting with a command-like word, and
	// `pnpm-lock.yaml` from false-positiving into bash.
	if (trimmed.startsWith("$") || /^(?:npm|pnpm|yarn|npx|curl|docker|git|psql|createdb|brew|nvm|node|corepack)(?:\s|$)/.test(trimmed)) {
		return "bash";
	}

	// TypeScript / JavaScript first — object/array literal configs (`export
	// default [...]`, `const config = { ... }`) must win over the JSON test
	// below (which would otherwise claim `export default [` because it starts
	// with `[` and contains quotes). Only reach the JSON branch for blocks that
	// start with `{`/`[` AND are not TS/JS.
	if (
		/\b(?:export (?:default|function|const|interface|type)|import .* from|function\s+[A-Za-z_$][\w$]*\s*\()/.test(trimmed) ||
		/^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*[=:]/.test(firstLine)
	) {
		return "typescript";
	}

	// SQL.
	if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(trimmed)) {
		return "sql";
	}

	// Prisma schema keywords.
	if (/\b(?:model|enum|generator|datasource)\b/.test(trimmed)) {
		return "prisma";
	}

	// JSON — only for blocks that START with `{` or `[` (excludes prose and
	// inline strings), still guarded against TS-style object/array configs that
	// start with `export`/`const`/`import` (already caught above).
	const firstChar = trimmed.charAt(0);
	if ((firstChar === "{" || firstChar === "[") && (trimmed.includes(":") || trimmed.includes('"'))) {
		return "json";
	}

	return "plaintext";
}

/** GitHub-style diff line classes — one-dark-pro-adjacent hues, translucent fills. */
function diffLineClasses(line: string): string {
	if (line.startsWith("+")) {
		return "bg-emerald-500/10 text-emerald-300";
	}
	if (line.startsWith("-")) {
		return "bg-red-500/10 text-red-300";
	}
	if (line.startsWith("@@")) {
		return "bg-sky-500/10 text-sky-300";
	}
	return "text-slate-300";
}

export interface CodeBlockProps {
	readonly code: string;
	readonly language?: CodeLanguage;
	readonly className?: string;
	readonly fileName?: string;
	readonly showLineNumbers?: boolean;
	readonly showDownloadButton?: boolean;
	readonly detectLanguage?: boolean;
	/** 1-based line numbers to tint with the highlight accent (shiki transformer). */
	readonly highlightLines?: readonly number[];
	/** Accepted for renderer API compatibility; the minimap is not implemented. */
	readonly showMinimap?: boolean;
}

export function CodeBlock({
	code,
	language,
	className,
	fileName,
	showLineNumbers = false,
	showDownloadButton = false,
	detectLanguage = false,
	highlightLines = NO_HIGHLIGHTS,
}: CodeBlockProps): React.JSX.Element {
	const [html, setHtml] = React.useState<string | null>(null);
	const [copied, setCopied] = React.useState(false);
	const [wrapped, setWrapped] = React.useState(false);
	const [expanded, setExpanded] = React.useState(false);

	// The language label is derived directly from props (pure function), so it
	// needs no state — computing it here keeps the effect free of sync setState.
	const lang = detectLanguage ? detectLanguageName(code) : (language ?? "plaintext");
	// `diff` renders through a pure-CSS path — the shiki effect skips it.
	const isDiff = lang === "diff";

	const lineCount = code.split("\n").length;
	const isLong = lineCount > MAX_COLLAPSED_LINES;
	const isCollapsed = isLong && !expanded;

	// Clamp + dedupe + sort the requested highlights so a stale `{99}` in the
	// fence can never blow up shiki or render out-of-range tints.
	const validHighlights = React.useMemo((): readonly number[] => {
		const unique = new Set<number>();
		for (const line of highlightLines) {
			if (Number.isInteger(line) && line >= 1 && line <= lineCount) {
				unique.add(line);
			}
		}
		return [...unique].sort((a, b): number => a - b);
	}, [highlightLines, lineCount]);

	React.useEffect(() => {
		// The diff renderer is pure CSS — no shiki grammar needed.
		if (isDiff) {
			return undefined;
		}

		let cancelled = false;

		void getHighlighter().then((highlighter): void => {
			if (cancelled) {
				return;
			}
			const shikiLang = SHIKI_LANG[lang];
			if (shikiLang === undefined) {
				// Unknown/plaintext language — fall back to the plain <pre>.
				setHtml(null);
				return;
			}
			// Single-theme output: every token span gets its `color` inline, and the
			// `<pre>` carries the theme's background + base color. No CSS-var
			// switching needed — One Dark Pro renders identically in both modes.
			// Always applied — the `\n` strip is required for gutter alignment even
			// when no lines are highlighted.
			const transformers = [codeBlockTransformer(new Set(validHighlights))];
			setHtml(highlighter.codeToHtml(code, { lang: shikiLang, theme: THEME, transformers }));
		});

		return (): void => {
			cancelled = true;
		};
	}, [code, lang, isDiff, validHighlights]);

	const handleCopy = React.useCallback((): void => {
		void navigator.clipboard
			.writeText(code)
			.then((): void => {
				setCopied(true);
				setTimeout((): void => {
					setCopied(false);
				}, 2000);
				// Name the copy target — "Copied auth.controller.ts" beats a
				// silent icon flip, especially for untitled inline blocks.
				toast.success(`Copied ${fileName ?? lang}`, { description: "The code is on your clipboard." });
			})
			.catch((): void => {
				toast.error("Could not copy code", { description: "Your browser blocked clipboard access." });
			});
	}, [code, fileName, lang]);

	const handleDownload = React.useCallback((): void => {
		const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = fileName ?? "code.txt";
		link.click();
		URL.revokeObjectURL(url);
	}, [code, fileName]);

	const handleToggleWrap = React.useCallback((): void => {
		setWrapped((value): boolean => !value);
	}, []);

	const handleToggleExpand = React.useCallback((): void => {
		setExpanded((value): boolean => !value);
	}, []);

	return (
		<div className={cn("overflow-hidden rounded-lg border border-black/20 bg-[#282c34] shadow-sm dark:border-white/10", className)}>
			{/* ── Header bar — One Dark Pro surface in both themes ─────────── */}
			<div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-1.5">
				<div className="flex min-w-0 items-center gap-2 text-xs">
					{/* Language accent: colored dot + colored label — the block's
					    language is identifiable at a glance (shiki-aligned hues) */}
					<span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", LANG_COLORS[lang].dot)} />
					<span className={cn("truncate font-medium", LANG_COLORS[lang].label)}>{fileName ?? lang}</span>
					{/* Highlight chip — only once the shiki tint is actually applied (html !==
					    null), so the chip never promises a highlight the fallback lacks. */}
					{html !== null && validHighlights.length > 0 ? (
						<span className="shrink-0 rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
							{String(validHighlights.length)} line{validHighlights.length === 1 ? "" : "s"} highlighted
						</span>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					{showDownloadButton ? (
						<button
							type="button"
							onClick={handleDownload}
							className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
							aria-label="Download code">
							<Download className="size-3.5" />
						</button>
					) : null}
					<button
						type="button"
						onClick={handleToggleWrap}
						aria-pressed={wrapped}
						aria-label="Toggle word wrap"
						title={wrapped ? "Disable word wrap" : "Enable word wrap"}
						className={cn("rounded-md p-1.5 transition-colors hover:bg-muted hover:text-foreground", wrapped ? "text-sky-300" : "text-muted-foreground/60")}>
						<WrapText className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={handleCopy}
						className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
						aria-label="Copy code">
						{copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
					</button>
				</div>
			</div>

			{/* ── Body ──────────────────────────────────────────────── */}
			{/* 48rem = 30 lines × 24px (leading-6) + the body's 24px py-3 padding, so
			    the full 30th line sits above the fold when collapsed. */}
			<div className={cn("relative", isCollapsed && "max-h-[48rem] overflow-hidden")}>
				<div className="overflow-x-auto">
					{isDiff ? (
						/* Diff path — GitHub-style +/−/@@ lines, pure CSS (no shiki). */
						<div className="flex">
							{showLineNumbers ? <LineNumberGutter lineCount={lineCount} /> : null}
							<pre
								className={cn("min-w-0 flex-1 overflow-x-auto py-3 font-mono text-[13px] leading-6", wrapped && "overflow-x-visible")}
								style={{ backgroundColor: THEME_BG }}>
								{/* Diff lines have no stable unique identity (line text can repeat) and
								    the block is static — the index IS the line number: a legitimate key. */}
								{/* eslint-disable react/no-array-index-key */}
								{code.split("\n").map((line, index) => (
									<span key={index} className={cn("block px-4", wrapped ? "break-words whitespace-pre-wrap" : "whitespace-pre", diffLineClasses(line))}>
										{line.length === 0 ? " " : line}
									</span>
								))}
								{/* eslint-enable react/no-array-index-key */}
							</pre>
						</div>
					) : html === null ? (
						/* Plain fallback — shown until the shiki highlight resolves. */
						<pre className={cn("px-4 py-3 font-mono text-[13px] leading-6 text-slate-300", wrapped && "break-words whitespace-pre-wrap")}>
							<code>{code}</code>
						</pre>
					) : (
						/* Shiki-highlighted body — line numbers + token colors. */
						<div className="flex">
							{showLineNumbers ? <LineNumberGutter lineCount={lineCount} /> : null}
							<div
								className={cn(
									"min-w-0 flex-1 py-3 [&_code]:text-[13px]! [&_code]:leading-6! [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0! [&_pre]:shadow-none!",
									// Shiki emits `.line` spans as INLINE elements separated by literal
									// `\n` text nodes. The transformer strips those newlines, so a plain
									// `display: block` gives every row EXACTLY the 24px `leading-6` the
									// number gutter uses — measured against the gutter, the pitch now
									// matches 1:1 (inline rows were ~17px tall, and the `\n` nodes
									// added phantom 17px rows that drifted the numbering). Browsers
									// synthesize newlines between block boxes on copy, so select-copy
									// still produces line-separated text. Highlighted lines add the
									// tint on top. Note: with word wrap ON, a long line wraps inside
									// its block, so numbers represent LOGICAL lines (like VS Code).
									"[&_.highlight-line]:bg-[rgba(97,175,239,0.14)] [&_.highlight-line]:shadow-[inset_2px_0_0_#61afef] [&_.line]:block",
									wrapped && "[&_pre]:break-words! [&_pre]:whitespace-pre-wrap!",
								)}
								style={{ backgroundColor: THEME_BG }}
								dangerouslySetInnerHTML={{ __html: html }}
							/>
						</div>
					)}
				</div>

				{/* ── Long-block collapse ────────────────────────────── */}
				{isLong ? (
					<button
						type="button"
						onClick={handleToggleExpand}
						aria-expanded={!isCollapsed}
						className={cn(
							"flex w-full items-center justify-center text-xs font-medium text-sky-300 transition-colors hover:text-sky-200",
							isCollapsed ? "absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-[#282c34] via-[#282c34]/80 to-transparent pt-16 pb-2" : "py-2",
						)}>
						<span className={cn("rounded-full border px-3 py-1 shadow-sm", isCollapsed ? "border-white/10 bg-[#282c34]/90 backdrop-blur-sm" : "border-white/10 bg-white/5")}>
							{isCollapsed ? `Show all ${String(lineCount)} lines` : "Show less"}
						</span>
					</button>
				) : null}
			</div>
		</div>
	);
}

/** Line-number gutter shared by the shiki + diff body paths. */
function LineNumberGutter({ lineCount }: { readonly lineCount: number }): React.JSX.Element {
	return (
		<div aria-hidden className="shrink-0 border-r border-white/10 px-3 py-3 text-right font-mono text-[13px] leading-6 text-slate-500 select-none">
			{Array.from({ length: lineCount }, (_, index) => (
				<div key={index}>{index + 1}</div>
			))}
		</div>
	);
}
