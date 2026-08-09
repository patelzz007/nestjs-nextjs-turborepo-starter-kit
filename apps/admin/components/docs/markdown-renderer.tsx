"use client";

import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";
import { AlertOctagon, AlertTriangle, Check, CheckCircle2, Copy, Info, ZoomIn } from "lucide-react";
import type { Blockquote, Root, Text } from "mdast";
import * as React from "react";
import { isValidElement, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

import { CodeBlock } from "@/components/docs/code-block";
import { MermaidDiagram } from "@/components/docs/mermaid-diagram";
import { DocsTable } from "@/components/docs/docs-table";
import { HEADING_SCROLL_OFFSET } from "@/lib/constants";
import { detectQuoteKind, GLOSSARY_TERMS, QUOTE_MARKER_KINDS, QuoteKindSchema, slugifyHeadingText, type QuoteKind } from "@/lib/docs/markdown";
import { CodeLanguage } from "@/lib/docs/code-block";

// ─── Remark plugins ─────────────────────────────────────────────────────────

/** Light pastel callout classes per kind — "don't make it too dark". */
const QUOTE_KIND_CLASSES: Readonly<Record<QuoteKind, string>> = {
	info: "border-blue-400/60 bg-blue-50 text-blue-900 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-200",
	warning: "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-200",
	error: "border-red-400/60 bg-red-50 text-red-900 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200",
	success: "border-emerald-400/60 bg-emerald-50 text-emerald-900 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200",
};

/** Icon per callout kind (for the title line). */
const QUOTE_KIND_ICONS: Readonly<Record<QuoteKind, React.ComponentType<{ readonly className?: string }>>> = {
	info: Info,
	warning: AlertTriangle,
	error: AlertOctagon,
	success: CheckCircle2,
};

/** `[!TIP]` markers render as a pull-quote (larger, decorative) instead of a plain callout. */
const PULL_QUOTE_MARKERS: readonly [string, ...string[]] = ["tip"];

/** Recursively joins all text in a blockquote (for quote-kind detection). */
function collectQuoteText(node: Blockquote): string {
	let result = "";
	visit(node, (child) => {
		if (child.type === "text" || child.type === "inlineCode") {
			result += child.value;
		}
	});
	return result;
}

/**
 * Color-codes blockquotes by kind. Supports GitHub-style markers
 * (`> [!NOTE]`, `> [!WARNING]`, `> [!ERROR]`, `> [!SUCCESS]` — stripped from
 * the rendered text) and falls back to keyword detection from the quote body.
 * The kind's Tailwind classes are attached via `node.data.hProperties.className`,
 * which `mdast-util-to-hast` merges into the hast element's properties, so the
 * React `blockquote` component receives them as its `className` prop.
 */
function remarkQuoteKindsPlugin(): (tree: Root) => void {
	const MARKER_PATTERN = /^\[!(NOTE|INFO|TIP|SUCCESS|WARNING|CAUTION|IMPORTANT|ERROR|DANGER)\]\s*/i;

	return function transformer(tree: Root): void {
		visit(tree, "blockquote", (node) => {
			const text = collectQuoteText(node);
			const markerMatch = MARKER_PATTERN.exec(text);
			const kind: QuoteKind = markerMatch?.[1] !== undefined ? (QUOTE_MARKER_KINDS[markerMatch[1].toLowerCase()] ?? "info") : detectQuoteKind(text);

			// Strip the `[!KIND]` marker from the first paragraph's leading text node.
			// Two shapes exist in the wild:
			//
			// 1. Canonical — `> [!NOTE]` on its own line, blank `>` line, then
			//    content. The marker is the paragraph's ONLY child, so stripping
			//    it empties the paragraph — remove that paragraph, otherwise a
			//    stray empty `<p>` (with `mt-4` spacing) renders inside the
			//    callout.
			// 2. Inline — `> [!NOTE] **Title:** body`. The marker text node sits
			//    next to a `<strong>` (and the rest of the paragraph). Stripping
			//    empties ONLY the marker text node — splicing the paragraph out
			//    here would silently delete the title AND the body (the
			//    "callout box renders but the wording is missing" bug). Remove
			//    just the marker text node and keep the paragraph.
			if (markerMatch !== null) {
				const firstParagraphIndex = node.children.findIndex((child) => child.type === "paragraph");
				const firstParagraph = firstParagraphIndex >= 0 ? node.children[firstParagraphIndex] : undefined;
				if (firstParagraph?.type === "paragraph") {
					const firstTextIndex = firstParagraph.children.findIndex((child) => child.type === "text");
					const firstText = firstTextIndex >= 0 ? firstParagraph.children[firstTextIndex] : undefined;
					if (firstText?.type === "text") {
						const stripped = firstText.value.replace(MARKER_PATTERN, "").trimStart();
						if (stripped.length === 0) {
							if (firstParagraph.children.length <= 1) {
								// Shape 1 — marker is the whole paragraph: drop it.
								node.children.splice(firstParagraphIndex, 1);
							} else {
								// Shape 2 — marker text node only: drop the node, keep
								// the title + body that follow it.
								firstParagraph.children.splice(firstTextIndex, 1);
							}
						} else {
							firstText.value = stripped;
						}
					}
				}
			}

			// `[!TIP]` renders as a decorative pull-quote; everything else is a
			// standard callout.
			const isPullQuote = markerMatch?.[1] !== undefined && PULL_QUOTE_MARKERS.includes(markerMatch[1].toLowerCase());
			node.data = {
				...(node.data ?? {}),
				hProperties: {
					...(node.data?.hProperties ?? {}),
					// hast `Properties.className` is a string array — the plugin's
					// classes merge with any the markdown itself provided.
					className: [QUOTE_KIND_CLASSES[kind], ...(isPullQuote ? ["pull-quote"] : [])],
					// The kind is ALSO stamped as a data attribute so the component
					// can pick the matching icon — reverse-mapping the color classes
					// would be fragile string sniffing.
					"data-quote-kind": kind,
				},
			};
		});
	};
}

/**
 * Marks the FIRST paragraph of the article body (after the opening h1) so the
 * prose component can give it a drop-cap treatment. The renderer's `p`
 * component keys off the marker class instead of a fragile "first child"
 * check.
 */
function remarkFirstParagraphPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		let found = false;
		visit(tree, "paragraph", (node, _index, parent) => {
			if (found) {
				return;
			}
			// Only the article's first paragraph DIRECTLY under the root gets the
			// drop-cap. `visit` also walks nested paragraphs (e.g. inside a
			// `> [!NOTE]` callout) — letting one of those steal the marker would
			// render a drop-cap inside the callout.
			if (parent?.type !== "root") {
				return;
			}
			found = true;
			node.data = {
				...(node.data ?? {}),
				hProperties: {
					...(node.data?.hProperties ?? {}),
					className: ["docs-first-paragraph"],
				},
			};
		});
	};
}

/**
 * Wraps glossary keywords in `<abbr title="…">` for hover tooltips. Exact
 * word-boundary matches on the plain text (not inside code spans); long
 * matched words are bounded so a term can't swallow surrounding text.
 */
function remarkGlossaryPlugin(): (tree: Root) => void {
	// Longest-first so a multi-word term is matched before its prefix.
	const sortedTerms: readonly { readonly term: string; readonly definition: string }[] = [...GLOSSARY_TERMS].sort((a, b) => b.term.length - a.term.length);

	return function transformer(tree: Root): void {
		visit(tree, "paragraph", (node) => {
			for (const child of node.children) {
				if (child.type !== "text") {
					continue;
				}
				const textNode = child;
				// Typed as the mdast union we actually emit (plain text + HTML nodes), NOT
				// `ReactNode` — ReactNode includes numbers/iterables which would make the
				// `typeof piece === "string"` narrowing below useless and the splice below
				// untypeable (mdast children must be PhrasingContent).
				const pieces: (string | { type: "html"; value: string })[] = [];
				let remaining = textNode.value;
				let changed = false;
				for (const { term, definition } of sortedTerms) {
					const pattern = new RegExp(`(^|[^A-Za-z0-9])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^A-Za-z0-9])`, "g");
					let match: RegExpExecArray | null;
					while ((match = pattern.exec(remaining)) !== null) {
						changed = true;
						const prefix = match[1] ?? "";
						const matchedTerm = match[2] ?? "";
						const suffix = remaining.slice(match.index + match[0].length);
						const before = remaining.slice(0, match.index + prefix.length);
						pieces.push(before, {
							type: "html",
							value: `<abbr title="${definition.replace(/"/g, "&quot;")}">${matchedTerm}</abbr>`,
						});
						remaining = suffix;
						pattern.lastIndex = 0;
					}
				}
				if (changed) {
					pieces.push(remaining);
					const replacements = pieces.map((piece): Text | { type: "html"; value: string } => {
						if (typeof piece === "string") {
							return { type: "text", value: piece } satisfies Text;
						}
						return piece;
					});
					node.children.splice(node.children.indexOf(child), 1, ...replacements);
				}
			}
		});
	};
}

function remarkUnwrapImagesPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		visit(tree, "paragraph", (node, index, parent) => {
			if (parent !== undefined && index !== undefined && node.children.length === 1 && node.children[0]?.type === "image") {
				const imageNode = node.children[0];
				parent.children.splice(index, 1, imageNode);
			}
		});
	};
}

// ─── Fence meta helpers ──────────────────────────────────────────────────────

/**
 * Parses the `{…}` range part of a fence's info string — ` ```ts {2-4,7} ` →
 * `[2, 3, 4, 7]`. GFM-style (` ```ts{2-4} `, no space) works too because the
 * braces are matched anywhere in the meta. Malformed parts are skipped.
 */
function parseHighlightMeta(meta: string): readonly number[] {
	const braceMatch = /\{([^}]*)\}/.exec(meta);
	if (braceMatch === null) {
		return [];
	}
	const lines: number[] = [];
	for (const rawPart of (braceMatch[1] ?? "").split(",")) {
		const part = rawPart.trim();
		if (part.length === 0) {
			continue;
		}
		const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
		if (rangeMatch !== null) {
			const start = Number(rangeMatch[1]);
			const end = Number(rangeMatch[2]);
			for (let line = start; line <= end; line += 1) {
				lines.push(line);
			}
		} else if (/^\d+$/.test(part)) {
			lines.push(Number(part));
		}
	}
	return lines;
}

// ─── Copy button for headings ───────────────────────────────────────────────

function CopyHeadingButton({ id }: { readonly id: string }): React.JSX.Element {
	const [copied, setCopied] = useState(false);

	const handleCopy = React.useCallback((): void => {
		const url = `${window.location.origin}${window.location.pathname}#${id}`;
		void navigator.clipboard
			.writeText(url)
			.then((): void => {
				setCopied(true);
				setTimeout((): void => {
					setCopied(false);
				}, 2000);
			})
			.catch((): void => {
				// Clipboard API unavailable — ignore.
			});
	}, [id]);

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover/heading:opacity-100 hover:bg-muted focus-visible:opacity-100"
			aria-label={`Copy link to ${id}`}
			title="Copy link to this section">
			{copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground/40" />}
		</button>
	);
}

// ─── Custom Markdown Components ────────────────────────────────────────────

const components: Partial<Components> = {
	// ── Code blocks ────────────────────────────────────────────────────────
	code({ node: _node, className, children, ...props }): React.JSX.Element {
		// remark-gfm puts the fence's meta string (everything after the
		// language) on the hast node's `data` — e.g. ` ```ts title="x.ts" ` →
		// `node.data.meta === 'title="x.ts"'`. The filename shows in the block
		// header. Optional chaining keeps this cast-free (rule 4).
		const nodeData = _node?.data;
		const nodeMeta = typeof nodeData?.meta === "string" ? nodeData.meta : "";
		const titleMatch = /title="([^"]+)"/.exec(nodeMeta);
		const fileName = titleMatch?.[1] ?? undefined;
		// ` ```ts {2-4,7} ` → the braces ride in the fence meta; the numbers
		// become the CodeBlock `highlightLines` (1-based) — the header shows a
		// "N lines highlighted" chip and shiki tints those lines.
		const highlightLines = parseHighlightMeta(nodeMeta);
		const languageMatch = /language-(\w+)/.exec(className ?? "");
		const language = languageMatch?.[1] ?? "";
		const codeString = extractTextFromReactNode(children).replace(/\n$/, "");

		// Handle Mermaid diagrams
		if (language === "mermaid" && codeString.includes("\n")) {
			return <MermaidDiagram chart={codeString} className="my-4" />;
		}

		// Handle fenced code blocks (with or without language)
		if (codeString.includes("\n")) {
			if (language) {
				// Language specified: use it, show line numbers
				const parsed = CodeLanguage.safeParse(language);
				const validLang = parsed.success ? parsed.data : "plaintext";

				return (
					<CodeBlock
						code={codeString}
						language={validLang}
						className="my-4"
						showLineNumbers
						fileName={fileName}
						highlightLines={highlightLines}
						showDownloadButton={false}
						showMinimap={false}
					/>
				);
			}

			// No language specified: auto-detect, hide line numbers (ASCII trees, etc.)
			return (
				<CodeBlock
					code={codeString}
					className="my-4"
					showLineNumbers={false}
					fileName={fileName}
					highlightLines={highlightLines}
					showDownloadButton={false}
					showMinimap={false}
					detectLanguage
				/>
			);
		}

		// Inline code
		return (
			<code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground")} {...props}>
				{children}
			</code>
		);
	},

	// ── Headings with anchor links + copy button ───────────────────────────
	h1({ node: _node, children, ...props }): React.JSX.Element {
		const id = extractId(children);
		return (
			<HeadingWithScroll
				id={id}
				tag="h1"
				className="group/heading mt-10 mb-5 flex items-center gap-2 text-3xl font-semibold tracking-tight text-balance first:mt-0"
				{...props}>
				{children}
			</HeadingWithScroll>
		);
	},
	h2({ node: _node, children, ...props }): React.JSX.Element {
		const id = extractId(children);
		return (
			<HeadingWithScroll id={id} tag="h2" className="group/heading mt-10 mb-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-balance" {...props}>
				{children}
			</HeadingWithScroll>
		);
	},
	h3({ node: _node, children, ...props }): React.JSX.Element {
		const id = extractId(children);
		return (
			<HeadingWithScroll id={id} tag="h3" className="group/heading mt-8 mb-2 flex items-center gap-2 text-lg font-semibold tracking-tight" {...props}>
				{children}
			</HeadingWithScroll>
		);
	},
	h4({ node: _node, children, ...props }): React.JSX.Element {
		const id = extractId(children);
		return (
			<HeadingWithScroll id={id} tag="h4" className="group/heading mt-6 mb-2 flex items-center gap-2 text-base font-semibold" {...props}>
				{children}
			</HeadingWithScroll>
		);
	},

	// ── Paragraphs (with a drop-cap on the opening paragraph) ───────────────
	p({ node: _node, className, children, ...props }): React.JSX.Element {
		// The remark plugin stamps the marker into the hast className, which
		// arrives here as a prop.
		const isFirstParagraph = className?.includes("docs-first-paragraph") ?? false;
		return (
			<p className={cn("text-[15px] leading-7 text-pretty text-foreground/90 not-first:mt-4", isFirstParagraph && "docs-first-paragraph")} {...props}>
				{children}
			</p>
		);
	},

	// ── Links ──────────────────────────────────────────────────────────────
	a({ node: _node, href, children, ...props }): React.JSX.Element {
		const isExternal = (href?.startsWith("http") ?? false) || (href?.startsWith("mailto:") ?? false);
		// Internal links to other `.md` docs resolve to their admin `/docs/<slug>` page.
		const isMarkdownDoc = href?.endsWith(".md") ?? false;
		const docBasename =
			href
				?.replace(/\.md.*$/, "")
				.split("/")
				.pop() ?? "";
		const resolvedHref = isMarkdownDoc ? `/docs/${docBasename}` : href;
		return (
			<a
				href={resolvedHref}
				target={isExternal ? "_blank" : undefined}
				rel={isExternal ? "noopener noreferrer" : undefined}
				className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
				{...props}>
				{children}
				{isExternal ? (
					<svg
						className="-mt-0.5 ml-0.5 inline-block h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						<polyline points="15 3 21 3 21 9" />
						<line x1="10" y1="14" x2="21" y2="3" />
					</svg>
				) : null}
			</a>
		);
	},

	// ── Lists ──────────────────────────────────────────────────────────────
	ul({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<ul className="my-4 ml-5 list-disc space-y-2 text-[15px] leading-7 marker:text-muted-foreground/60" {...props}>
				{children}
			</ul>
		);
	},
	ol({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<ol className="my-4 ml-5 list-decimal space-y-2 text-[15px] leading-7 marker:text-muted-foreground/60" {...props}>
				{children}
			</ol>
		);
	},
	li({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<li className="text-[15px] leading-7" {...props}>
				{children}
			</li>
		);
	},

	// ── Blockquotes — color-coded callouts with icon + title line ──────────
	// The remark `remarkQuoteKindsPlugin` attaches the kind's classes; here we
	// render the leading `**Title:**` (if any) as a bold icon header. `[!TIP]`
	// markers render as a decorative pull-quote instead of a callout.
	blockquote({ node: _node, className, children, ...props }): React.JSX.Element {
		const flattened = flattenForCallout(children);
		const titleMatch = /^\*\*([^*]+)\*\*\s*:?\s*(.*)$/s.exec(flattened);
		const isPullQuote = (className ?? "").includes("pull-quote");
		// The kind is stamped on the hast node's properties by the remark
		// plugin — zod-parse it (rule 13) so a malformed value degrades to the
		// neutral info kind instead of blowing up or being string-sniffed.
		const properties = _node?.properties;
		const kindResult = QuoteKindSchema.safeParse(properties?.["data-quote-kind"]);
		const kind: QuoteKind = kindResult.success ? kindResult.data : "info";
		const Icon = QUOTE_KIND_ICONS[kind];
		const title = titleMatch?.[1] ?? "";
		const body = titleMatch !== null ? (titleMatch[2] ?? "") : flattened;

		if (isPullQuote) {
			return (
				<blockquote
					className={cn("my-10 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent px-8 py-7 text-center", className)}
					{...props}>
					<span aria-hidden="true" className="block text-4xl leading-none text-primary/30 select-none">
						"
					</span>
					<div className="mx-auto max-w-xl text-[15px] leading-7 text-foreground/90">
						{title.length > 0 ? <strong className="mb-1 block font-semibold text-primary">{title}</strong> : null}
						{body}
					</div>
				</blockquote>
			);
		}

		return (
			<blockquote className={cn("my-6 rounded-r-lg border-l-4 px-4 py-3 text-[15px] leading-7", className)} {...props}>
				{title.length > 0 ? (
					<strong className="mb-1.5 flex items-center gap-2 font-semibold">
						<Icon className="size-4 shrink-0" />
						{title}
					</strong>
				) : null}
				{title.length > 0 ? (
					<div>{body}</div>
				) : (
					// No title — the kind icon leads the content inline so the
					// color-coding always has its icon counterpart.
					<div className="flex items-start gap-2">
						<Icon className="mt-1 size-4 shrink-0" />
						<div className="min-w-0 flex-1">{children}</div>
					</div>
				)}
			</blockquote>
		);
	},

	// ── Tables — interactive docs tables (sticky header, zebra, hover) ─────
	table({ node: _node, children, ...props }): React.JSX.Element {
		return <DocsTable {...props}>{children}</DocsTable>;
	},
	thead({ node: _node, children, ...props }): React.JSX.Element {
		return <thead {...props}>{children}</thead>;
	},
	tbody({ node: _node, children, ...props }): React.JSX.Element {
		return <tbody {...props}>{children}</tbody>;
	},
	tr({ node: _node, children, ...props }): React.JSX.Element {
		return <tr {...props}>{children}</tr>;
	},
	th({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<th className="px-4 py-2.5 text-left text-[13px] font-semibold whitespace-nowrap" {...props}>
				{children}
			</th>
		);
	},
	td({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<td className="px-4 py-2.5 align-top text-[13px] leading-6 whitespace-nowrap first:font-medium" {...props}>
				{children}
			</td>
		);
	},

	// ── Horizontal rules ───────────────────────────────────────────────────
	hr({ node: _node, ...props }): React.JSX.Element {
		return <hr className="my-10 border-border/60" {...props} />;
	},

	// ── Inline code / bold / em ────────────────────────────────────────────
	strong({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<strong className="font-semibold text-foreground" {...props}>
				{children}
			</strong>
		);
	},
	em({ node: _node, children, ...props }): React.JSX.Element {
		return <em {...props}>{children}</em>;
	},

	// ── Images — framed, with a click-to-zoom lightbox ─────────────────────
	img({ node: _node, src, alt, ...props }): React.JSX.Element {
		const srcString = typeof src === "string" ? src : undefined;
		const isLocal = srcString?.startsWith("/") ?? false;
		const isExternal = srcString?.startsWith("http") ?? false;

		return (
			<figure className="group/image not-prose my-8">
				<div className="relative overflow-hidden rounded-xl border border-border/40 bg-muted/20">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={srcString}
						alt={alt ?? ""}
						className="max-h-125 w-full object-contain transition-all duration-500 group-hover/image:scale-[1.02]"
						loading="lazy"
						width={isLocal || isExternal ? undefined : 800}
						height={isLocal || isExternal ? undefined : 450}
						{...props}
					/>
					{/* Zoom affordance — appears on hover, always tappable on touch */}
					<button
						type="button"
						aria-label="Zoom image"
						className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover/image:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
						data-lightbox-src={srcString ?? ""}
						data-lightbox-alt={alt ?? ""}
						onClick={handleLightboxClick}>
						<ZoomIn className="size-4" />
					</button>
					<div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/5 transition-all duration-500 ring-inset group-hover/image:ring-primary/20 dark:ring-white/5" />
				</div>
				{alt ? <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground/50 italic">{alt}</figcaption> : null}
			</figure>
		);
	},

	// ── Task lists ─────────────────────────────────────────────────────────
	input({ node: _node, type, checked, ...props }): React.JSX.Element {
		if (type === "checkbox") {
			return <input type="checkbox" checked={checked} readOnly className="mt-0.5 mr-2 h-4 w-4 shrink-0 rounded border-primary accent-primary" {...props} />;
		}
		return <input type={type} {...props} />;
	},
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Flattens blockquote children to plain text (for callout title detection).
 * Inline code + links keep their text; bold/emphasis markers are stripped so
 * a `**Locked out?**` title is detected cleanly.
 */
function flattenForCallout(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(flattenForCallout).join("");
	}
	if (isElementWithChildren(node)) {
		// Strip markdown-bold asterisks from the strong wrapper (react-markdown
		// renders **bold** as <strong> — text content is all we need).
		return flattenForCallout(node.props.children);
	}
	return "";
}

/**
 * Creates the shared lightbox `<dialog>` (lazily, once) with its backdrop-close
 * wiring. Returns the non-null element so callers never re-check for null.
 */
function createLightboxDialog(): HTMLDialogElement {
	const dialog = document.createElement("dialog");
	dialog.setAttribute("data-docs-lightbox", "true");
	dialog.className =
		"fixed inset-0 z-50 m-auto max-w-[92vw] max-h-[88vh] rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm";
	// Click on the backdrop closes the dialog (the event target is the
	// dialog itself only when the backdrop — not the image — was clicked).
	dialog.addEventListener("click", (event): void => {
		if (event.target === dialog) {
			dialog.close();
		}
	});
	// Accessible name for screen readers — the dialog contains only an image
	// plus an icon button, so it needs an explicit label.
	dialog.setAttribute("aria-label", "Image preview");
	return dialog;
}

/** Opens the shared image lightbox (a native <dialog>, created on demand). */
function openLightbox(trigger: HTMLElement): void {
	const src = trigger.getAttribute("data-lightbox-src") ?? "";
	const alt = trigger.getAttribute("data-lightbox-alt") ?? "";
	let dialog = document.querySelector<HTMLDialogElement>("dialog[data-docs-lightbox]");
	if (dialog === null) {
		dialog = createLightboxDialog();
		document.body.appendChild(dialog);
	}
	// Replace content — re-created on every open so the src/alt stay fresh.
	dialog.replaceChildren();
	const img = document.createElement("img");
	img.src = src;
	img.alt = alt;
	img.className = "block max-h-[80vh] w-auto max-w-full rounded-xl object-contain";
	const closeButton = document.createElement("button");
	closeButton.type = "button";
	closeButton.textContent = "✕";
	closeButton.setAttribute("aria-label", "Close image");
	closeButton.className =
		"absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-sm text-white transition-colors hover:bg-black/80";
	closeButton.addEventListener("click", (): void => {
		dialog.close();
	});
	const wrapper = document.createElement("div");
	wrapper.className = "relative";
	wrapper.append(img, closeButton);
	dialog.append(wrapper);
	dialog.showModal();
}

/** Type guard: checks if a React element has a children prop with ReactNode content */
function isElementWithChildren(node: ReactNode): node is ReactElement & { props: { children: ReactNode } } {
	return isValidElement(node) && node.props !== null && typeof node.props === "object" && "children" in node.props;
}

/** Recursively extract plain text from React nodes, including inline elements like <code> */
function extractTextFromReactNode(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}

	if (Array.isArray(node)) {
		return node.map(extractTextFromReactNode).join("");
	}

	// React element — recurse into its children prop
	if (isElementWithChildren(node)) {
		return extractTextFromReactNode(node.props.children);
	}

	return "";
}

function extractId(children: ReactNode): string {
	return slugifyHeadingText(extractTextFromReactNode(children));
}

/** Lightbox trigger handler — opens the shared dialog for the clicked image. */
const handleLightboxClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
	event.preventDefault();
	openLightbox(event.currentTarget);
};

// ─── Heading wrapper — applies the shared scroll-margin via inline style ────

interface HeadingWithScrollProps extends React.HTMLAttributes<HTMLHeadingElement> {
	readonly id: string;
	readonly tag: "h1" | "h2" | "h3" | "h4";
}

function HeadingWithScroll({ children, id, tag: Tag, className, style, ...rest }: HeadingWithScrollProps): React.JSX.Element {
	return (
		<Tag id={id} className={className} style={{ ...style, scrollMarginTop: HEADING_SCROLL_OFFSET }} {...rest}>
			<span>{children}</span>
			{id.length > 0 ? <CopyHeadingButton id={id} /> : null}
		</Tag>
	);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export interface MarkdownRendererProps {
	readonly content: string;
	readonly className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps): React.JSX.Element {
	return (
		<div className={cn("markdown-body max-w-none text-foreground", className)}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath, remarkUnwrapImagesPlugin, remarkQuoteKindsPlugin, remarkFirstParagraphPlugin, remarkGlossaryPlugin]}
				rehypePlugins={[rehypeKatex]}
				components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
