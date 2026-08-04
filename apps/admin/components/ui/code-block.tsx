"use client";

import { Check, Copy, Download, FileCode2 } from "lucide-react";
import * as React from "react";
import { createHighlighter, type BundledLanguage, type BundledTheme, type Highlighter } from "shiki";

import { cn } from "@/lib/utils";
import { CodeLanguage } from "@/lib/types/code-block";

/**
 * CodeBlock — a polished, shiki-powered code viewer used by the markdown
 * renderer. Dumb and presentational: it receives the code + language via props
 * and renders a header bar (language label, optional download, copy button) and
 * the highlighted body (optional line-number gutter). The shiki highlighter is
 * created once and shared (module-level promise).
 */

/**
 * Maps app-level language names to shiki's bundled language ids. `plaintext`
 * is intentionally absent — shiki v4 has no plaintext grammar, so those blocks
 * render unhighlighted instead.
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
};

const THEMES: readonly [BundledTheme, BundledTheme] = ["github-light", "github-dark"];

let highlighterPromise: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
	highlighterPromise ??= createHighlighter({
		themes: [...THEMES],
		langs: [...new Set(Object.values(SHIKI_LANG))],
	});
	return highlighterPromise;
}

/** Cheap heuristic used only when the fence tag is missing (the docs always tag their fences). */
function detectLanguageName(code: string): CodeLanguage {
	const trimmed = code.trim();
	if (trimmed.startsWith("$") || /\b(?:npm|pnpm|yarn|npx|curl|docker|git|psql|createdb)\b/.test(trimmed)) {
		return "bash";
	}
	const firstChar = trimmed.charAt(0);
	if ((firstChar === "{" || firstChar === "[") && (trimmed.includes(":") || trimmed.includes('"'))) {
		return "json";
	}
	if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(trimmed)) {
		return "sql";
	}
	if (/\b(?:export (?:function|const|default|interface|type)|import .* from)\b/.test(trimmed)) {
		return "typescript";
	}
	if (/\b(?:model|enum|generator|datasource)\b/.test(trimmed)) {
		return "prisma";
	}
	return "plaintext";
}

export interface CodeBlockProps {
	readonly code: string;
	readonly language?: CodeLanguage;
	readonly className?: string;
	readonly fileName?: string;
	readonly showLineNumbers?: boolean;
	readonly showDownloadButton?: boolean;
	readonly detectLanguage?: boolean;
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
}: CodeBlockProps): React.JSX.Element {
	const [html, setHtml] = React.useState<string | null>(null);
	const [copied, setCopied] = React.useState(false);

	// The language label is derived directly from props (pure function), so it
	// needs no state — computing it here keeps the effect free of sync setState.
	const lang = detectLanguage ? detectLanguageName(code) : (language ?? "plaintext");

	React.useEffect(() => {
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
			setHtml(highlighter.codeToHtml(code, { lang: shikiLang, themes: { light: THEMES[0], dark: THEMES[1] }, defaultColor: "light" }));
		});

		return (): void => {
			cancelled = true;
		};
	}, [code, lang]);

	const handleCopy = React.useCallback((): void => {
		void navigator.clipboard
			.writeText(code)
			.then((): void => {
				setCopied(true);
				setTimeout((): void => {
					setCopied(false);
				}, 2000);
			})
			.catch((): void => {
				// Clipboard API unavailable — ignore.
			});
	}, [code]);

	const handleDownload = React.useCallback((): void => {
		const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = fileName ?? "code.txt";
		link.click();
		URL.revokeObjectURL(url);
	}, [code, fileName]);

	const lineCount = code.split("\n").length;

	return (
		<div className={cn("overflow-hidden rounded-lg border border-border bg-muted/30", className)}>
			{/* ── Header bar ─────────────────────────────────────────── */}
			<div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5">
				<div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
					<FileCode2 className="size-3.5 shrink-0" />
					<span className="truncate font-medium">{fileName ?? lang}</span>
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
						onClick={handleCopy}
						className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
						aria-label="Copy code">
						{copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
					</button>
				</div>
			</div>

			{/* ── Body ──────────────────────────────────────────────── */}
			<div className="overflow-x-auto">
				{html === null ? (
					<pre className="px-4 py-3 font-mono text-[13px] leading-6 text-muted-foreground">
						<code>{code}</code>
					</pre>
				) : (
					<div className="flex">
						{showLineNumbers ? (
							<div aria-hidden className="shrink-0 border-r border-border/40 px-3 py-3 text-right font-mono text-[13px] leading-6 text-muted-foreground/40 select-none">
								{Array.from({ length: lineCount }, (_, index) => (
									<div key={index}>{index + 1}</div>
								))}
							</div>
						) : null}
						<div
							className="min-w-0 flex-1 py-3 [&_code]:text-[13px]! [&_code]:leading-6! [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0! [&_pre]:shadow-none!"
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
