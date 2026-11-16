// The showcase's written content (overviews, FAQ answers, docs) drawn from its
// Markdown in the app's own type roles: headings, paragraphs, lists, quotes,
// tables, rules and code. Two fenced languages are the showcase's own and are
// drawn by the caller (`fences`): ```showcase-api``` (the API reference) and
// ```showcase-example``` (an example by id). A link into the showcase
// (`/showcase/button`) opens that screen; an http(s) link opens the browser;
// anything else is drawn as text.

import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { useRouter, type Href } from "expo-router";
import * as React from "react";
import { Linking, ScrollView, Text, View } from "react-native";

import { openableHref, parseMarkdown, type MarkdownBlock, type MarkdownInline, type MarkdownListItem } from "../../lib/markdown";
import { showcaseHrefOf } from "./showcase-links";

/** How a fenced block of one of the showcase's own languages is drawn, from its body. */
export type MarkdownFences = Readonly<Record<string, (body: string) => React.ReactNode>>;

const NO_FENCES: MarkdownFences = {};

/** Text size and face of each heading level (the overview's `##` and `###`). */
const HEADING_CLASSES: readonly string[] = ["font-sans-bold text-h2", "font-heading text-h3", "font-heading text-h4", "font-heading text-body-lg"];
const BODY_TEXT = "text-body font-sans text-foreground";

type OpenLink = (href: string) => void;

/** Opens a link: into the showcase in the app, out to the browser for http(s); nothing for anything else. */
function useOpenLink(): OpenLink {
	const router = useRouter();
	return React.useCallback(
		(href: string): void => {
			const inApp: Href | null = showcaseHrefOf(href);
			if (inApp !== null) {
				router.push(inApp);
				return;
			}
			const external = openableHref(href);
			if (external !== null) {
				Linking.openURL(external).catch((): void => {
					// No app could open it: nothing to do.
				});
			}
		},
		[router],
	);
}

interface InlinesProps {
	readonly inlines: readonly MarkdownInline[];
	readonly openLink: OpenLink;
}

/** Inline content, nested inside its block's Text. */
function Inlines({ inlines, openLink }: InlinesProps): React.JSX.Element {
	return (
		<>
			{inlines.map((inline: MarkdownInline, index: number): React.ReactNode => {
				const key = `${inline.kind}-${String(index)}`;
				switch (inline.kind) {
					case "text":
						return inline.text;
					case "strong":
						return (
							<Text key={key} className="font-sans-semibold">
								<Inlines inlines={inline.children} openLink={openLink} />
							</Text>
						);
					case "emphasis":
						return (
							<Text key={key} className="italic">
								<Inlines inlines={inline.children} openLink={openLink} />
							</Text>
						);
					case "strike":
						return (
							<Text key={key} className="line-through">
								<Inlines inlines={inline.children} openLink={openLink} />
							</Text>
						);
					case "code":
						return (
							<Text key={key} className="font-code bg-muted text-foreground">
								{` ${inline.text} `}
							</Text>
						);
					case "link":
						return <LinkText key={key} href={inline.href} inlines={inline.children} openLink={openLink} />;
					case "image":
						return inline.alt;
					case "break":
						return "\n";
				}
			})}
		</>
	);
}

interface LinkTextProps {
	readonly href: string;
	readonly inlines: readonly MarkdownInline[];
	readonly openLink: OpenLink;
}

function LinkText({ href, inlines, openLink }: LinkTextProps): React.JSX.Element {
	const onPress = React.useCallback((): void => {
		openLink(href);
	}, [href, openLink]);
	return (
		<Text accessibilityRole="link" onPress={onPress} className="font-sans-medium text-link underline">
			<Inlines inlines={inlines} openLink={openLink} />
		</Text>
	);
}

interface BlocksProps {
	readonly blocks: readonly MarkdownBlock[];
	readonly fences: MarkdownFences;
	readonly openLink: OpenLink;
}

function Blocks({ blocks, fences, openLink }: BlocksProps): React.JSX.Element {
	return (
		<>
			{blocks.map((block: MarkdownBlock, index: number): React.JSX.Element => (
				<Block key={`${block.kind}-${String(index)}`} block={block} fences={fences} openLink={openLink} />
			))}
		</>
	);
}

interface BlockProps {
	readonly block: MarkdownBlock;
	readonly fences: MarkdownFences;
	readonly openLink: OpenLink;
}

function Block({ block, fences, openLink }: BlockProps): React.JSX.Element | null {
	switch (block.kind) {
		case "paragraph":
			return (
				<Text className={BODY_TEXT}>
					<Inlines inlines={block.children} openLink={openLink} />
				</Text>
			);
		case "heading":
			return (
				<Text accessibilityRole="header" className={`${HEADING_CLASSES.at(Math.max(block.level - 2, 0)) ?? BODY_TEXT} mt-2 text-foreground`}>
					<Inlines inlines={block.children} openLink={openLink} />
				</Text>
			);
		case "code": {
			const fence = block.language === null ? undefined : fences[block.language];
			if (fence !== undefined) {
				return <>{fence(block.text)}</>;
			}
			return <CodeBlock code={block.text} size="sm" {...(block.language === null ? {} : { language: block.language })} />;
		}
		case "quote":
			return (
				<View className="gap-2 border-l-2 border-border pl-3">
					<Blocks blocks={block.blocks} fences={fences} openLink={openLink} />
				</View>
			);
		case "list":
			return (
				<View className="gap-1.5">
					{block.items.map((item: MarkdownListItem, index: number): React.JSX.Element => (
						<View key={`item-${String(index)}`} className="flex-row gap-2">
							<Text className={`${BODY_TEXT} text-muted-foreground`}>{block.ordered ? `${String(block.start + index)}.` : "•"}</Text>
							<View className="flex-1 gap-1.5">
								<Blocks blocks={item.blocks} fences={fences} openLink={openLink} />
							</View>
						</View>
					))}
				</View>
			);
		case "rule":
			return <View className="h-px bg-border" />;
		case "image":
			return <Text className={BODY_TEXT}>{block.alt}</Text>;
		case "table":
			return <Table header={block.header} rows={block.rows} openLink={openLink} />;
	}
}

interface TableProps {
	readonly header: readonly (readonly MarkdownInline[])[];
	readonly rows: readonly (readonly (readonly MarkdownInline[])[])[];
	readonly openLink: OpenLink;
}

/** A table, scrolled sideways when it is wider than the screen. */
function Table({ header, rows, openLink }: TableProps): React.JSX.Element {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-card border border-border">
			<View>
				<View className="flex-row border-b border-border bg-muted">
					{header.map((cell: readonly MarkdownInline[], index: number): React.JSX.Element => (
						<Text key={`head-${String(index)}`} className="text-label font-sans-semibold w-44 px-3 py-2 text-foreground">
							<Inlines inlines={cell} openLink={openLink} />
						</Text>
					))}
				</View>
				{rows.map((row: readonly (readonly MarkdownInline[])[], rowIndex: number): React.JSX.Element => (
					<View key={`row-${String(rowIndex)}`} className="flex-row border-b border-border">
						{row.map((cell: readonly MarkdownInline[], index: number): React.JSX.Element => (
							<Text key={`cell-${String(index)}`} className="text-body w-44 px-3 py-2 font-sans text-foreground">
								<Inlines inlines={cell} openLink={openLink} />
							</Text>
						))}
					</View>
				))}
			</View>
		</ScrollView>
	);
}

export interface ShowcaseMarkdownProps {
	readonly source: string;
	/** How the showcase's own fenced languages are drawn. */
	readonly fences?: MarkdownFences;
	readonly testID?: string;
}

/** Markdown drawn in the app's type roles, with the showcase's own fences. */
export function ShowcaseMarkdown({ source, fences = NO_FENCES, testID }: ShowcaseMarkdownProps): React.JSX.Element {
	const blocks = React.useMemo((): readonly MarkdownBlock[] => parseMarkdown(source), [source]);
	const openLink = useOpenLink();
	return (
		<View className="gap-3" testID={testID}>
			<Blocks blocks={blocks} fences={fences} openLink={openLink} />
		</View>
	);
}
