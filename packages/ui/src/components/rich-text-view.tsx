"use client";

import type { RichTextBlock, RichTextDocument, RichTextInline, RichTextListItem, RichTextMark, RichTextTableRow, RichTextText } from "@workspace/shared";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@workspace/ui/components/code-block";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

// The in-app view of a broadcast body (ADR 073): drawn from the stored JSON, never from HTML, so only
// the allowed nodes can ever appear. Tables scroll sideways on a narrow screen; code blocks carry a Copy
// button; the call-to-action shows its real domain beside the button.

export interface RichTextViewProps {
	/** A body as the API answers it: each picture carries its address (`src`); one without isn't shown. */
	readonly document: RichTextDocument;
	readonly className?: string;
}

/** The host a call-to-action really goes to, shown beside its button. */
export function richTextLinkHost(href: string): string {
	return URL.canParse(href) ? new URL(href).host : href;
}

/** One child of a node with a stable id: its path in the document (the body never reorders). */
interface Positioned<TItem> {
	readonly id: string;
	readonly item: TItem;
}

function positioned<TItem>(items: readonly TItem[], parentId: string): readonly Positioned<TItem>[] {
	return items.map((item, position): Positioned<TItem> => ({ id: `${parentId}.${String(position)}`, item }));
}

function wrapMark(mark: RichTextMark, children: React.ReactNode): React.ReactNode {
	switch (mark.type) {
		case "bold":
			return <strong>{children}</strong>;
		case "italic":
			return <em>{children}</em>;
		case "underline":
			return <u>{children}</u>;
		case "strike":
			return <s>{children}</s>;
		case "code":
			return <code className="rounded bg-muted px-1 font-mono text-[0.85em]">{children}</code>;
		case "link":
			return (
				<a href={mark.attrs.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
					{children}
				</a>
			);
	}
}

function TextRun({ text }: { readonly text: RichTextText }): React.JSX.Element {
	return <>{(text.marks ?? []).reduceRight((children: React.ReactNode, mark: RichTextMark): React.ReactNode => wrapMark(mark, children), text.text)}</>;
}

function Inlines({ inlines }: { readonly inlines: readonly RichTextInline[] }): React.JSX.Element {
	return <>{positioned(inlines, "i").map(({ id, item }): React.JSX.Element => (item.type === "hardBreak" ? <br key={id} /> : <TextRun key={id} text={item} />))}</>;
}

function plainText(inlines: readonly RichTextInline[]): string {
	return inlines.map((inline): string => (inline.type === "text" ? inline.text : "\n")).join("");
}

interface BlockProps {
	readonly block: RichTextBlock;
}

function ListItems({ items }: { readonly items: readonly RichTextListItem[] }): React.JSX.Element {
	return (
		<>
			{positioned(items, "li").map(({ id, item }): React.JSX.Element => (
				<li key={id} className="[&>*+*]:mt-1">
					<Blocks blocks={item.content} />
				</li>
			))}
		</>
	);
}

function TableRows({ rows }: { readonly rows: readonly RichTextTableRow[] }): React.JSX.Element {
	return (
		<>
			{positioned(rows, "tr").map(({ id: rowId, item: row }): React.JSX.Element => (
				<tr key={rowId}>
					{positioned(row.content, rowId).map(({ id: cellId, item: cell }): React.JSX.Element => {
						const Cell = cell.type === "tableHeader" ? "th" : "td";
						return (
							<Cell
								key={cellId}
								scope={cell.type === "tableHeader" ? "col" : undefined}
								className={cn("border border-border px-2 py-1 align-top", cell.type === "tableHeader" && "bg-muted text-start font-medium")}>
								<Blocks blocks={cell.content} />
							</Cell>
						);
					})}
				</tr>
			))}
		</>
	);
}

function Block({ block }: BlockProps): React.JSX.Element | null {
	switch (block.type) {
		case "paragraph":
			return (
				<p>
					<Inlines inlines={block.content ?? []} />
				</p>
			);
		case "heading":
			return block.attrs.level === 2 ? (
				<h2 className="text-lg font-semibold">
					<Inlines inlines={block.content ?? []} />
				</h2>
			) : (
				<h3 className="text-base font-semibold">
					<Inlines inlines={block.content ?? []} />
				</h3>
			);
		case "codeBlock": {
			const language = block.attrs?.language ?? "text";
			return (
				<CodeBlock code={plainText(block.content ?? [])} language="text" highlight={false} label={`${language} code`}>
					<CodeBlockHeader>
						<CodeBlockTitle>{language}</CodeBlockTitle>
						<div className="ms-auto flex items-center gap-1">
							<CodeBlockCopyButton />
						</div>
					</CodeBlockHeader>
				</CodeBlock>
			);
		}
		case "bulletList":
			return (
				<ul className="list-disc ps-5">
					<ListItems items={block.content} />
				</ul>
			);
		case "orderedList":
			return (
				<ol className="list-decimal ps-5" start={block.attrs?.start}>
					<ListItems items={block.content} />
				</ol>
			);
		case "blockquote":
			return (
				<blockquote className="border-s-2 border-border ps-3 text-muted-foreground">
					<Blocks blocks={block.content} />
				</blockquote>
			);
		case "horizontalRule":
			return <hr className="border-border" />;
		case "image": {
			const src = block.attrs.src;
			return src === undefined ? null : <img src={src} alt={block.attrs.alt} className="h-auto max-w-full rounded-md" loading="lazy" />;
		}
		case "callToAction":
			return (
				<p className="flex flex-wrap items-center gap-2">
					<a
						href={block.attrs.href}
						target="_blank"
						rel="noopener noreferrer nofollow"
						className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90">
						{block.attrs.label}
					</a>
					<span className="text-xs text-muted-foreground">{richTextLinkHost(block.attrs.href)}</span>
				</p>
			);
		case "table":
			return (
				<div className="overflow-x-auto" role="region" aria-label="Table">
					<table className="w-full border-collapse text-sm">
						<tbody>
							<TableRows rows={block.content} />
						</tbody>
					</table>
				</div>
			);
	}
}

function Blocks({ blocks }: { readonly blocks: readonly RichTextBlock[] }): React.JSX.Element {
	return (
		<>
			{positioned(blocks, "b").map(({ id, item }): React.JSX.Element => (
				<Block key={id} block={item} />
			))}
		</>
	);
}

/** A broadcast body as customers read it in the app. */
export function RichTextView({ document, className }: RichTextViewProps): React.JSX.Element {
	return (
		<div data-slot="rich-text-view" className={cn("text-sm leading-relaxed text-foreground [&>*+*]:mt-3", className)}>
			<Blocks blocks={document.content} />
		</div>
	);
}
