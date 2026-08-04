"use client";

import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import type { Root } from "mdast";
import * as React from "react";
import { isValidElement, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

import { CodeBlock } from "@/components/ui/code-block";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { HEADING_SCROLL_OFFSET } from "@/lib/constants";
import { slugifyHeadingText } from "@/lib/markdown";
import { CodeLanguage } from "@/lib/types/code-block";

// ─── Remark plugin: unwrap standalone images from <p> tags ──────────────────

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

				return <CodeBlock code={codeString} language={validLang} className="my-4" showLineNumbers fileName={undefined} showDownloadButton={false} showMinimap={false} />;
			}

			// No language specified: auto-detect, hide line numbers (ASCII trees, etc.)
			return <CodeBlock code={codeString} className="my-4" showLineNumbers={false} fileName={undefined} showDownloadButton={false} showMinimap={false} detectLanguage />;
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

	// ── Paragraphs ────────────────────────────────────────────────────────
	p({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<p className="text-[15px] leading-7 text-pretty text-foreground/90 not-first:mt-4" {...props}>
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

	// ── Blockquotes ────────────────────────────────────────────────────────
	blockquote({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<blockquote className="my-6 rounded-r-lg border-l-2 border-foreground/15 bg-muted/40 px-4 py-3 text-[15px] leading-7 text-foreground/80" {...props}>
				{children}
			</blockquote>
		);
	},

	// ── Tables ─────────────────────────────────────────────────────────────
	table({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<div className="my-8 w-full overflow-auto">
				<Table {...props}>{children}</Table>
			</div>
		);
	},
	thead({ node: _node, children, ...props }): React.JSX.Element {
		return <TableHeader {...props}>{children}</TableHeader>;
	},
	tbody({ node: _node, children, ...props }): React.JSX.Element {
		return <TableBody {...props}>{children}</TableBody>;
	},
	tr({ node: _node, children, ...props }): React.JSX.Element {
		return <TableRow {...props}>{children}</TableRow>;
	},
	th({ node: _node, children, ...props }): React.JSX.Element {
		return (
			<TableHead className="font-semibold" {...props}>
				{children}
			</TableHead>
		);
	},
	td({ node: _node, children, ...props }): React.JSX.Element {
		return <TableCell {...props}>{children}</TableCell>;
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

	// ── Images ─────────────────────────────────────────────────────────────
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

// ─── Heading wrapper — applies the shared scroll-margin via inline style ────

function HeadingWithScroll({
	children,
	id,
	tag: Tag,
	className,
}: {
	readonly children: ReactNode;
	readonly id: string;
	readonly tag: "h1" | "h2" | "h3" | "h4";
	readonly className: string;
}): React.JSX.Element {
	return (
		<Tag id={id} className={className} style={{ scrollMarginTop: HEADING_SCROLL_OFFSET }}>
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
			<ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkUnwrapImagesPlugin]} rehypePlugins={[rehypeKatex]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
