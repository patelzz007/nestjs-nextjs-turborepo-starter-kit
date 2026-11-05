// A broadcast's rich body drawn natively (ADR 073): from the stored JSON, never from HTML, so only the
// allowed nodes can appear. Marks nest as Text runs; links and the call-to-action open through the
// caller (`onOpenLink`), which decides how a URL is opened; tables scroll sideways; code blocks are the
// kit's CodeBlock with the caller's Copy. Data-agnostic: an image shows only when the
// API gave it an address (`src`, enhancement 5.4).

import type { RichTextBlock, RichTextDocument, RichTextInline, RichTextListItem, RichTextMark, RichTextTableRow, RichTextText } from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import * as React from "react";
import { ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { CodeBlock } from "./code-block";

/** The body's surface: blocks stacked with the kit's rhythm. One look; `variant` keeps the kit's shape. */
export const richTextViewVariants = cva("gap-3", {
	variants: { variant: { default: "" } },
	defaultVariants: { variant: "default" },
});

export type RichTextViewVariant = NonNullable<VariantProps<typeof richTextViewVariants>["variant"]>;

export interface RichTextViewProps {
	readonly variant?: RichTextViewVariant | undefined;
	readonly document: RichTextDocument;
	/** Open a link or the call-to-action's address (the caller confirms or opens it in the browser). */
	readonly onOpenLink: (href: string) => void;
	/** Copy a code block's text; without it code blocks have no Copy button. */
	readonly onCopyCode?: ((code: string) => void) | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The host a link really goes to, shown beside the call-to-action. */
export function richTextLinkHost(href: string): string {
	return URL.canParse(href) ? new URL(href).host : href;
}

/** A child with a stable id: its path in the document (a stored body never reorders). */
interface Positioned<TItem> {
	readonly id: string;
	readonly item: TItem;
}

function positioned<TItem>(items: readonly TItem[], parentId: string): readonly Positioned<TItem>[] {
	return items.map((item, position): Positioned<TItem> => ({ id: `${parentId}.${String(position)}`, item }));
}

/** The classes each mark adds to its run. */
function markClass(mark: RichTextMark): string {
	switch (mark.type) {
		case "bold":
			return "font-sans-semibold";
		case "italic":
			return "italic";
		case "underline":
			return "underline";
		case "strike":
			return "line-through";
		case "code":
			return "font-mono bg-muted";
		case "link":
			return "text-primary underline";
	}
}

interface RunProps {
	readonly text: RichTextText;
	readonly onOpenLink: (href: string) => void;
}

function TextRun({ text, onOpenLink }: RunProps): React.JSX.Element {
	const marks = text.marks ?? [];
	const link = marks.find((mark): mark is Extract<RichTextMark, { readonly type: "link" }> => mark.type === "link");
	const href = link?.attrs.href;
	const handlePress = React.useCallback((): void => {
		if (href !== undefined) {
			onOpenLink(href);
		}
	}, [href, onOpenLink]);
	return (
		<Text className={cn(...marks.map(markClass))} {...(href === undefined ? {} : { onPress: handlePress, accessibilityRole: "link" })}>
			{text.text}
		</Text>
	);
}

function Inlines({
	inlines,
	onOpenLink,
	className,
}: {
	readonly inlines: readonly RichTextInline[];
	readonly onOpenLink: (href: string) => void;
	readonly className: string;
}): React.JSX.Element {
	return (
		<Text className={className}>
			{positioned(inlines, "i").map(({ id, item }): React.JSX.Element =>
				item.type === "hardBreak" ? <Text key={id}>{"\n"}</Text> : <TextRun key={id} text={item} onOpenLink={onOpenLink} />,
			)}
		</Text>
	);
}

function plainText(inlines: readonly RichTextInline[]): string {
	return inlines.map((inline): string => (inline.type === "text" ? inline.text : "\n")).join("");
}

interface BlockContext {
	readonly onOpenLink: (href: string) => void;
	readonly onCopyCode: ((code: string) => void) | undefined;
}

function Blocks({ blocks, context }: { readonly blocks: readonly RichTextBlock[]; readonly context: BlockContext }): React.JSX.Element {
	return (
		<View className="gap-3">
			{positioned(blocks, "b").map(({ id, item }): React.JSX.Element => (
				<Block key={id} block={item} context={context} />
			))}
		</View>
	);
}

function ListItems({
	items,
	ordered,
	start,
	context,
}: {
	readonly items: readonly RichTextListItem[];
	readonly ordered: boolean;
	readonly start: number;
	readonly context: BlockContext;
}): React.JSX.Element {
	return (
		<View className="gap-1.5">
			{positioned(items, "li").map(({ id, item }, position): React.JSX.Element => (
				<View key={id} className="flex-row gap-2">
					<Text className="font-sans text-base text-muted-foreground">{ordered ? `${String(start + position)}.` : "•"}</Text>
					<View className="flex-1">
						<Blocks blocks={item.content} context={context} />
					</View>
				</View>
			))}
		</View>
	);
}

function TableRows({ rows, context }: { readonly rows: readonly RichTextTableRow[]; readonly context: BlockContext }): React.JSX.Element {
	return (
		<View className="rounded-md border border-border">
			{positioned(rows, "tr").map(({ id: rowId, item: row }): React.JSX.Element => (
				<View key={rowId} className="flex-row border-b border-border last:border-b-0">
					{positioned(row.content, rowId).map(({ id: cellId, item: cell }): React.JSX.Element => (
						<View
							key={cellId}
							className={cn("w-36 border-r border-border px-2 py-1.5 last:border-r-0", cell.type === "tableHeader" && "bg-muted")}
							accessibilityRole={cell.type === "tableHeader" ? "header" : undefined}>
							<Blocks blocks={cell.content} context={context} />
						</View>
					))}
				</View>
			))}
		</View>
	);
}

function CopyableCode({
	code,
	language,
	onCopyCode,
}: {
	readonly code: string;
	readonly language: string;
	readonly onCopyCode: ((code: string) => void) | undefined;
}): React.JSX.Element {
	const [copied, setCopied] = React.useState(false);
	const handleCopy = React.useCallback((): void => {
		onCopyCode?.(code);
		setCopied(true);
	}, [code, onCopyCode]);
	return <CodeBlock code={code} language={language} {...(onCopyCode === undefined ? {} : { onCopy: handleCopy, copied })} size="sm" />;
}

function CallToActionButton({ label, href, onOpenLink }: { readonly label: string; readonly href: string; readonly onOpenLink: (href: string) => void }): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onOpenLink(href);
	}, [href, onOpenLink]);
	return (
		<View className="gap-1">
			<Button label={label} onPress={handlePress} accessibilityHint={`Opens ${richTextLinkHost(href)}`} />
			<Text className="text-center font-sans text-xs text-muted-foreground">{richTextLinkHost(href)}</Text>
		</View>
	);
}

function BodyImage({ uri, alt }: { readonly uri: string; readonly alt: string }): React.JSX.Element {
	const source = React.useMemo((): { readonly uri: string } => ({ uri }), [uri]);
	return <Image source={source} accessibilityLabel={alt} contentFit="contain" className="aspect-video w-full rounded-md" />;
}

function Block({ block, context }: { readonly block: RichTextBlock; readonly context: BlockContext }): React.JSX.Element | null {
	switch (block.type) {
		case "paragraph":
			return <Inlines inlines={block.content ?? []} onOpenLink={context.onOpenLink} className="font-sans text-base text-foreground" />;
		case "heading":
			return (
				<Text accessibilityRole="header">
					<Inlines
						inlines={block.content ?? []}
						onOpenLink={context.onOpenLink}
						className={cn("font-heading text-foreground", block.attrs.level === 2 ? "text-xl" : "text-lg")}
					/>
				</Text>
			);
		case "codeBlock":
			return <CopyableCode code={plainText(block.content ?? [])} language={block.attrs?.language ?? "text"} onCopyCode={context.onCopyCode} />;
		case "bulletList":
			return <ListItems items={block.content} ordered={false} start={1} context={context} />;
		case "orderedList":
			return <ListItems items={block.content} ordered start={block.attrs?.start ?? 1} context={context} />;
		case "blockquote":
			return (
				<View className="border-l-2 border-border pl-3">
					<Blocks blocks={block.content} context={context} />
				</View>
			);
		case "horizontalRule":
			return <View className="h-px bg-border" />;
		case "image": {
			const uri = block.attrs.src;
			return uri === undefined ? null : <BodyImage uri={uri} alt={block.attrs.alt} />;
		}
		case "callToAction":
			return <CallToActionButton label={block.attrs.label} href={block.attrs.href} onOpenLink={context.onOpenLink} />;
		case "table":
			return (
				<ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Table">
					<TableRows rows={block.content} context={context} />
				</ScrollView>
			);
	}
}

/** A broadcast body as the app's inbox shows it. */
export const RichTextView = React.memo(
	React.forwardRef<ViewInstance, RichTextViewProps>(function RichTextView(
		{ document, onOpenLink, onCopyCode, variant = "default", className, testID },
		ref,
	): React.JSX.Element {
		const context = React.useMemo((): BlockContext => ({ onOpenLink, onCopyCode }), [onCopyCode, onOpenLink]);
		return (
			<View ref={ref} className={cn(richTextViewVariants({ variant }), className)} testID={testID}>
				<Blocks blocks={document.content} context={context} />
			</View>
		);
	}),
);
