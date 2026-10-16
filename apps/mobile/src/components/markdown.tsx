// Markdown, drawn the way GitHub's app draws a comment: paragraphs, headings,
// code (inline and in scrollable blocks), quotes, lists with task checkboxes,
// tables, rules and pictures — in the app's own type roles and tokens, light
// and dark. Presentational: it parses the text it is given (src/lib/markdown.ts)
// and opens only http(s) links, in the browser. Text is selectable. Where a
// picture loads from is the caller's to say (`images`): a GitHub comment's
// pictures that GitHub shows only to signed-in readers load from the API,
// signed in, not from the address the markdown names.

import SquareIcon from "lucide-react-native/icons/square";
import SquareCheckIcon from "lucide-react-native/icons/square-check";
import * as React from "react";
import { Linking, ScrollView, Text, View } from "react-native";

import { openableHref, parseMarkdown, plainTextOf, type MarkdownBlock, type MarkdownInline, type MarkdownListItem } from "../lib/markdown";
import type { ImageSource } from "../lib/api-image-authorization";
import { Icon } from "@workspace/ui-native/components/icon";
import { MarkdownPicture } from "./markdown-picture";

/** How a body's pictures load: where each address loads from (`null`: not known yet — its tile shows), and what to do when one fails. */
export interface MarkdownImageLoader {
	readonly sourceFor: (href: string) => ImageSource | null;
	readonly onFailed?: ((source: ImageSource) => void) | undefined;
}

/** By default, each picture loads from the address the markdown names. */
const LOAD_FROM_ITSELF: MarkdownImageLoader = { sourceFor: (href: string): ImageSource => ({ uri: href }) };

const MarkdownImageLoaderContext = React.createContext<MarkdownImageLoader>(LOAD_FROM_ITSELF);
MarkdownImageLoaderContext.displayName = "MarkdownImageLoader";

/** Text size and weight of each heading level (h1 largest). */
const HEADING_CLASSES: readonly string[] = [
	"font-heading text-2xl",
	"font-heading text-xl",
	"font-heading text-lg",
	"font-sans-semibold text-base",
	"font-sans-semibold text-sm",
	"font-sans-semibold text-sm text-muted-foreground",
];

const BODY_TEXT = "font-sans text-base leading-6 text-foreground";

function openLink(href: string): void {
	const safe = openableHref(href);
	if (safe !== null) {
		Linking.openURL(safe).catch((): void => undefined);
	}
}

interface InlineProps {
	readonly children: readonly MarkdownInline[];
}

/** Inline content, nested inside one `Text` so it wraps as a single run. */
function Inline({ children }: InlineProps): React.JSX.Element {
	return (
		<>
			{children.map((child: MarkdownInline, index: number): React.JSX.Element => (
				// Inline runs never reorder; their position is their identity.
				<InlineNode key={`${child.kind}-${String(index)}`} node={child} />
			))}
		</>
	);
}

function InlineNode({ node }: { readonly node: MarkdownInline }): React.JSX.Element {
	switch (node.kind) {
		case "text":
			return <Text>{node.text}</Text>;
		case "strong":
			return (
				<Text className="font-sans-semibold">
					<Inline>{node.children}</Inline>
				</Text>
			);
		case "emphasis":
			return (
				<Text className="italic">
					<Inline>{node.children}</Inline>
				</Text>
			);
		case "strike":
			return (
				<Text className="line-through">
					<Inline>{node.children}</Inline>
				</Text>
			);
		case "code":
			return <Text className="rounded bg-muted font-mono text-sm text-foreground">{` ${node.text} `}</Text>;
		case "link":
			return <LinkText href={node.href}>{node.children}</LinkText>;
		case "image":
			return <LinkText href={node.href}>{[{ kind: "text", text: node.alt.length > 0 ? `Image: ${node.alt}` : "Image" }]}</LinkText>;
		case "break":
			return <Text>{"\n"}</Text>;
	}
}

interface LinkTextProps {
	readonly href: string;
	readonly children: readonly MarkdownInline[];
}

/** A link that opens in the browser — or, when it is not a web address, plain text. */
function LinkText({ href, children }: LinkTextProps): React.JSX.Element {
	const safe = openableHref(href);
	const open = React.useCallback((): void => {
		openLink(href);
	}, [href]);
	if (safe === null) {
		return <Inline>{children}</Inline>;
	}
	return (
		<Text accessibilityRole="link" accessibilityHint="Opens in your browser" onPress={open} className="text-info-foreground underline">
			<Inline>{children}</Inline>
		</Text>
	);
}

interface BlocksProps {
	readonly blocks: readonly MarkdownBlock[];
}

function Blocks({ blocks }: BlocksProps): React.JSX.Element {
	return (
		<View className="gap-3">
			{blocks.map((block: MarkdownBlock, index: number): React.JSX.Element => (
				// Blocks never reorder within one rendering of a body; their position is their identity.
				<Block key={`${block.kind}-${String(index)}`} block={block} />
			))}
		</View>
	);
}

function Block({ block }: { readonly block: MarkdownBlock }): React.JSX.Element {
	switch (block.kind) {
		case "paragraph":
			return (
				<Text selectable className={BODY_TEXT}>
					<Inline>{block.children}</Inline>
				</Text>
			);
		case "heading":
			return (
				<Text selectable accessibilityRole="header" className={`text-foreground ${HEADING_CLASSES.at(block.level - 1) ?? BODY_TEXT}`}>
					<Inline>{block.children}</Inline>
				</Text>
			);
		case "code":
			return (
				<ScrollView horizontal showsHorizontalScrollIndicator className="rounded-md bg-muted" contentContainerClassName="px-3 py-2.5">
					<Text selectable accessibilityLabel={block.language === null ? "Code" : `${block.language} code`} className="font-mono text-sm leading-5 text-foreground">
						{block.text}
					</Text>
				</ScrollView>
			);
		case "quote":
			return (
				<View className="border-l-4 border-border pl-3">
					<Blocks blocks={block.blocks} />
				</View>
			);
		case "list":
			return <List ordered={block.ordered} start={block.start} items={block.items} />;
		case "rule":
			return <View accessibilityRole="none" className="h-px bg-border" />;
		case "table":
			return <Table header={block.header} rows={block.rows} />;
		case "image":
			return <ResolvedPicture block={block} />;
	}
}

/** A picture block, loaded from where the caller's loader says. */
function ResolvedPicture({ block }: { readonly block: Extract<MarkdownBlock, { readonly kind: "image" }> }): React.JSX.Element {
	const loader = React.useContext(MarkdownImageLoaderContext);
	return <MarkdownPicture image={block} source={loader.sourceFor(block.href)} link={block.link} onFailed={loader.onFailed} />;
}

interface ListProps {
	readonly ordered: boolean;
	readonly start: number;
	readonly items: readonly MarkdownListItem[];
}

function List({ ordered, start, items }: ListProps): React.JSX.Element {
	return (
		<View className="gap-1.5">
			{items.map((item: MarkdownListItem, index: number): React.JSX.Element => (
				<View key={`item-${String(index)}`} className="flex-row gap-2">
					<ListMarker ordered={ordered} number={start + index} checked={item.checked} />
					<View className="flex-1">
						<Blocks blocks={item.blocks} />
					</View>
				</View>
			))}
		</View>
	);
}

interface ListMarkerProps {
	readonly ordered: boolean;
	readonly number: number;
	readonly checked: boolean | null;
}

/** A task's checkbox (read-only, as on GitHub's app), a number, or a bullet. */
function ListMarker({ ordered, number, checked }: ListMarkerProps): React.JSX.Element {
	if (checked !== null) {
		return (
			<View accessible accessibilityLabel={checked ? "Done" : "Not done"} className="pt-1">
				<Icon icon={checked ? SquareCheckIcon : SquareIcon} size="sm" colorClassName={checked ? "accent-success-foreground" : "accent-muted-foreground"} />
			</View>
		);
	}
	return <Text className={`min-w-5 ${BODY_TEXT} text-muted-foreground`}>{ordered ? `${String(number)}.` : "•"}</Text>;
}

interface TableProps {
	readonly header: readonly (readonly MarkdownInline[])[];
	readonly rows: readonly (readonly (readonly MarkdownInline[])[])[];
}

/** A table scrolls sideways when it is wider than the screen; every column is as wide as its widest cell. */
function Table({ header, rows }: TableProps): React.JSX.Element {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator>
			<View className="overflow-hidden rounded-md border border-border">
				<TableRow cells={header} isHeader />
				{rows.map((row: readonly (readonly MarkdownInline[])[], index: number): React.JSX.Element => (
					<TableRow key={`row-${String(index)}`} cells={row} isHeader={false} />
				))}
			</View>
		</ScrollView>
	);
}

interface TableRowProps {
	readonly cells: readonly (readonly MarkdownInline[])[];
	readonly isHeader: boolean;
}

function TableRow({ cells, isHeader }: TableRowProps): React.JSX.Element {
	return (
		<View className={`flex-row border-b border-border ${isHeader ? "bg-muted" : ""}`}>
			{cells.map((cell: readonly MarkdownInline[], index: number): React.JSX.Element => (
				<View key={`cell-${String(index)}`} className="min-w-24 border-r border-border px-3 py-2">
					<Text selectable accessibilityLabel={plainTextOf(cell)} className={`font-sans text-sm text-foreground ${isHeader ? "font-sans-semibold" : ""}`}>
						<Inline>{cell}</Inline>
					</Text>
				</View>
			))}
		</View>
	);
}

export interface MarkdownProps {
	/** The markdown source — a pull request description, a comment. */
	readonly source: string;
	/** Shown instead when the source is empty. */
	readonly emptyMessage?: string;
	/** How its pictures load; by default, each from the address the markdown names. */
	readonly images?: MarkdownImageLoader | undefined;
	readonly testID?: string;
}

export function Markdown({ source, emptyMessage, images = LOAD_FROM_ITSELF, testID }: MarkdownProps): React.JSX.Element {
	const blocks = React.useMemo(() => parseMarkdown(source), [source]);
	if (blocks.length === 0) {
		return <Text className="font-sans text-sm text-muted-foreground italic">{emptyMessage ?? "No description provided."}</Text>;
	}
	return (
		<MarkdownImageLoaderContext.Provider value={images}>
			<View testID={testID}>
				<Blocks blocks={blocks} />
			</View>
		</MarkdownImageLoaderContext.Provider>
	);
}
