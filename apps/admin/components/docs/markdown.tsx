import { Lightbulb, Link2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { appRoute } from "@workspace/client/lib/navigation/app-route";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockWrapToggle } from "@workspace/ui/components/code-block";
import { Separator } from "@workspace/ui/components/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { isArrayValue, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";

import { remarkHeadingIds } from "./doc-outline";

const LANGUAGE_CLASS = /language-(?<language>[\w+-]+)/u;

const LINK_CLASS = "font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground motion-safe:transition-colors";

/** The plain text of a code element's children (react-markdown passes strings, sometimes split in an array). */
function textOf(children: React.ReactNode): string {
	if (isStringPrimitive(children) || isNumberPrimitive(children)) {
		return String(children);
	}
	if (isArrayValue(children)) {
		return children.map((child) => textOf(child)).join("");
	}
	return "";
}

interface SectionHeadingProps {
	readonly id: string | undefined;
	readonly level: 2 | 3;
	readonly children: React.ReactNode;
}

/** A section heading with a link to itself that appears on hover or focus, as in Notion. */
function SectionHeading({ id, level, children }: SectionHeadingProps): React.JSX.Element {
	const Tag = level === 2 ? "h2" : "h3";
	return (
		<div className={level === 2 ? "group mt-12 mb-1 flex items-center gap-2" : "group mt-8 mb-1 flex items-center gap-2"}>
			<Tag
				id={id}
				className={level === 2 ? "scroll-mt-6 font-heading text-2xl font-semibold tracking-tight" : "scroll-mt-6 font-heading text-lg font-semibold tracking-tight"}>
				{children}
			</Tag>
			{id === undefined ? null : (
				<a
					href={`#${id}`}
					aria-label="Link to this section"
					aria-describedby={id}
					className="rounded-sm p-1 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-opacity">
					<Link2 aria-hidden="true" className="size-4" />
				</a>
			)}
		</div>
	);
}

/** Renders the body of a fenced block in a language a page owns (`showcase-api`), in place of a code block. */
export type MarkdownFenceRenderer = (body: string) => React.ReactNode;

/** Fenced-block renderers by language. */
export type MarkdownFences = Readonly<Record<string, MarkdownFenceRenderer>>;

const NO_FENCES: MarkdownFences = {};

/** The `code` element: inline code, a page-owned fence, or a highlighted code block. */
function codeRenderer(fences: MarkdownFences): NonNullable<Components["code"]> {
	return function MarkdownCode({ className, children }): React.ReactNode {
		const language = LANGUAGE_CLASS.exec(className ?? "")?.groups?.language;
		const source = textOf(children).replace(/\n$/u, "");
		if (language === undefined && !source.includes("\n")) {
			return <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em] text-tone-red">{children}</code>;
		}
		const fence = language === undefined ? undefined : fences[language];
		if (fence !== undefined) {
			return fence(source);
		}
		return (
			<CodeBlock code={source} language={language ?? "text"} showLineNumbers className="my-5">
				<CodeBlockHeader>
					<CodeBlockLanguage />
					<CodeBlockWrapToggle className="ms-auto" />
					<CodeBlockCopyButton />
				</CodeBlockHeader>
			</CodeBlock>
		);
	};
}

/** Markdown elements mapped onto the kit with Notion-like typography: code blocks (One Dark Pro), callouts, tables and links. */
const COMPONENTS: Components = {
	pre: ({ children }): React.JSX.Element => <>{children}</>,
	table: ({ children }): React.JSX.Element => (
		<div className="my-5 overflow-x-auto rounded-lg border border-border">
			<Table>{children}</Table>
		</div>
	),
	thead: ({ children }): React.JSX.Element => <TableHeader className="bg-muted/50">{children}</TableHeader>,
	tbody: ({ children }): React.JSX.Element => <TableBody>{children}</TableBody>,
	tr: ({ children }): React.JSX.Element => <TableRow>{children}</TableRow>,
	th: ({ children }): React.JSX.Element => <TableHead className="text-muted-foreground">{children}</TableHead>,
	td: ({ children }): React.JSX.Element => <TableCell className="align-top whitespace-normal">{children}</TableCell>,
	a: ({ href, children }): React.JSX.Element => {
		const target = href ?? "#";
		if (target.startsWith("/")) {
			return (
				<Link href={appRoute(target)} className={LINK_CLASS}>
					{children}
				</Link>
			);
		}
		if (target.startsWith("#")) {
			return (
				<a href={target} className={LINK_CLASS}>
					{children}
				</a>
			);
		}
		return (
			<a href={target} className={LINK_CLASS} rel="noreferrer noopener" target="_blank">
				{children}
			</a>
		);
	},
	// The page renders the guide's title; a stray `#` heading in the body reads as a section.
	h1: ({ id, children }): React.JSX.Element => (
		<SectionHeading id={id} level={2}>
			{children}
		</SectionHeading>
	),
	h2: ({ id, children }): React.JSX.Element => (
		<SectionHeading id={id} level={2}>
			{children}
		</SectionHeading>
	),
	h3: ({ id, children }): React.JSX.Element => (
		<SectionHeading id={id} level={3}>
			{children}
		</SectionHeading>
	),
	p: ({ children }): React.JSX.Element => <p className="my-2 leading-7 text-foreground/90">{children}</p>,
	ul: ({ children }): React.JSX.Element => <ul className="my-2 list-disc space-y-1 ps-6 leading-7 marker:text-muted-foreground">{children}</ul>,
	ol: ({ children }): React.JSX.Element => <ol className="my-2 list-decimal space-y-1 ps-6 leading-7 marker:text-muted-foreground">{children}</ol>,
	strong: ({ children }): React.JSX.Element => <strong className="font-semibold text-foreground">{children}</strong>,
	hr: (): React.JSX.Element => <Separator className="my-8" />,
	blockquote: ({ children }): React.JSX.Element => (
		<aside className="my-5 flex gap-3 rounded-lg bg-muted/60 px-4 py-3">
			<Lightbulb aria-hidden="true" className="mt-1.5 size-4 shrink-0 text-muted-foreground" />
			<div className="min-w-0 [&>p]:my-1">{children}</div>
		</aside>
	),
};

const REMARK_PLUGINS = [remarkGfm, remarkHeadingIds];

export interface MarkdownProps {
	readonly source: string;
	/** Renderers for fenced blocks in languages the page owns; any other fence is a code block. */
	readonly fences?: MarkdownFences | undefined;
}

/** Renders trusted markdown (the showcase's own docs) with the kit's components. Raw HTML is not rendered. */
export function Markdown({ source, fences = NO_FENCES }: MarkdownProps): React.JSX.Element {
	return (
		<ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={{ ...COMPONENTS, code: codeRenderer(fences) }}>
			{source}
		</ReactMarkdown>
	);
}
