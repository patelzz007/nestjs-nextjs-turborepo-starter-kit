// A block of code (the web kit's `CodeBlock`): monospaced in the code face
// (JetBrains Mono, `font-code`), never wrapped unless asked (`wrap`), and
// scrolled sideways when a line is wider than the screen. An optional header
// shows the language and a caption, and a copy button when the caller passes
// `onCopy`. The kit never touches the clipboard: the caller copies (expo-clipboard
// in the app) and says so through `copied`, which swaps the glyph and the name.
// `showLineNumbers` adds a gutter that stays put while the code scrolls; the
// numbers are never selected or copied with the code, nor read out.
//
// Colour comes from the caller: `lines` is the code already split into
// tokens, each with the role of what it is (keyword, string, comment…), drawn
// with the theme's `text-code-<role>` tokens, so light and dark follow the
// app's theme. The kit runs no highlighter (Hermes has no time to spare for
// one): a caller colours code ahead of time (the showcase does it when it is
// generated). `lineMarks` tints whole lines (a diff's added and removed lines,
// a highlighted range, an error or a warning), and `maxLines` folds a long
// block behind a "Show all" button — the one piece of display state the block
// keeps itself.
//
//   ┌ TYPESCRIPT · auth.ts ───────── ⧉ ┐   header: language, caption, copy
//   │ 1 │ const token = await signIn(…→│   gutter (optional) · code: scrolls sideways
//   │ 2 │ return token;                │   a marked line: tinted, with its sign in the gutter
//   ├──────── Show all 40 lines ───────┤   folded past `maxLines`
//   └──────────────────────────────────┘

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import CopyIcon from "lucide-react-native/icons/copy";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import {
	codeRows,
	highlightRanges,
	markTokens,
	type CodeFold,
	type CodeHighlight,
	type CodeLine,
	type CodeNote,
	type CodeRow,
	type CodeToken,
	type MarkedToken,
} from "../lib/code-block";
import { Icon } from "./icon";

export const codeBlockVariants = cva("w-full overflow-hidden rounded-lg border border-border", {
	variants: {
		/** `muted`: a block inside running text. `card`: a block that stands on its own surface. */
		variant: {
			muted: "bg-muted",
			card: "bg-card",
		},
	},
	defaultVariants: { variant: "muted" },
});

export const codeBlockTextVariants = cva("font-code text-foreground", {
	variants: {
		size: {
			sm: "text-caption",
			md: "text-body",
		},
	},
	defaultVariants: { size: "md" },
});

/** The padding around the code column (and the gutter's, so each number sits on its line). */
export const codeBlockPaddingVariants = cva("", {
	variants: {
		size: {
			sm: "px-3 py-2",
			md: "px-4 py-3",
		},
	},
	defaultVariants: { size: "md" },
});

/** The gutter beside the code: the same type, so each number sits on its line. */
export const codeBlockGutterVariants = cva("border-r border-border", {
	variants: {
		size: {
			sm: "py-2 pr-2 pl-3",
			md: "py-3 pr-3 pl-4",
		},
	},
	defaultVariants: { size: "md" },
});

/** The colour of one token, by what it is (the theme's code colours: GitHub light and dark, as on the web). */
export const codeTokenVariants = cva("", {
	variants: {
		role: {
			plain: "text-code-plain",
			keyword: "text-code-keyword",
			function: "text-code-function",
			constant: "text-code-constant",
			string: "text-code-string",
			comment: "text-code-comment",
			tag: "text-code-tag",
			parameter: "text-code-parameter",
			red: "text-tone-red",
			green: "text-tone-green",
			yellow: "text-tone-yellow",
			blue: "text-tone-blue",
			violet: "text-tone-violet",
			teal: "text-tone-teal",
			dim: "text-muted-foreground",
		},
	},
	defaultVariants: { role: "plain" },
});

/** The tint of a marked line. */
export const codeLineMarkVariants = cva("", {
	variants: {
		kind: {
			added: "bg-success-soft",
			removed: "bg-destructive-soft",
			highlight: "bg-primary-subtle",
			error: "bg-destructive-soft",
			warning: "bg-warning-soft",
		},
	},
});

/** The gutter's sign for a marked line, beside its number. */
const LINE_MARK_SIGN: Readonly<Record<CodeBlockLineMarkKind, string>> = { added: "+", removed: "−", highlight: " ", error: "!", warning: "!" };

type CodeBlockVariantProps = VariantProps<typeof codeBlockVariants>;
export type CodeBlockVariant = NonNullable<CodeBlockVariantProps["variant"]>;
export type CodeBlockSize = NonNullable<VariantProps<typeof codeBlockTextVariants>["size"]>;
export type CodeBlockTokenRole = NonNullable<VariantProps<typeof codeTokenVariants>["role"]>;
export type CodeBlockLineMarkKind = NonNullable<VariantProps<typeof codeLineMarkVariants>["kind"]>;

/** One piece of a coloured line: its text and what it is (`lib/code-block.ts`). */
export type CodeBlockToken = CodeToken;

/** A coloured line: its tokens, in order. */
export type CodeBlockLine = CodeLine;

/** A whole line tinted for a reason: a diff's added or removed line, a highlighted range, an error, a warning. */
export interface CodeBlockLineMark {
	/** The line's number as the gutter shows it (counting from `startLine`). */
	readonly line: number;
	readonly kind: CodeBlockLineMarkKind;
}

/** The tint of a highlighted stretch: a word pointed at, or a search match. */
export const codeHighlightVariants = cva("rounded-sm", {
	variants: { kind: { word: "bg-primary/15", match: "bg-tone-yellow-soft" } },
	defaultVariants: { kind: "word" },
});

/** A gutter action offered on lines (add a line to the chat, fix it): its sign, its name for a line, and what it does. */
export interface CodeBlockLineAction {
	readonly sign: string;
	readonly label: (line: number) => string;
	readonly onPress: (line: number) => void;
	/** The lines it is offered on; every line when left out. */
	readonly lines?: readonly number[] | undefined;
}

export interface CodeBlockLabels {
	/** The copy button's name before copying. */
	readonly copy: string;
	/** Its name once the caller reports the code copied. */
	readonly copied: string;
	/** A folded region's row: how many lines it hides ("⋯ 6 lines"). */
	readonly foldedLines: (count: number) => string;
	/** A fold toggle's name for its first line. */
	readonly toggleFold: (line: number) => string;
	/** A line number's name when pressing it selects the line. */
	readonly selectLine: (line: number) => string;
	/** The fold's button while folded: shows every line ("Show all 40 lines"). */
	readonly expand: (lineCount: number) => string;
	/** The fold's button while open: folds the block again. */
	readonly collapse: string;
}

/** The block's default names; generic and overridable one by one. */
export const DEFAULT_CODE_BLOCK_LABELS: CodeBlockLabels = {
	copy: "Copy code",
	copied: "Copied",
	foldedLines: (count: number): string => `⋯ ${String(count)} lines`,
	toggleFold: (line: number): string => `Fold or unfold from line ${String(line)}`,
	selectLine: (line: number): string => `Select line ${String(line)}`,
	expand: (lineCount: number): string => `Show all ${String(lineCount)} lines`,
	collapse: "Show fewer lines",
};

export interface CodeBlockProps {
	/** The code, as copied and as drawn when it has no `lines`. */
	readonly code: string;
	/** The code coloured by the caller, one token list per line of `code`. */
	readonly lines?: readonly CodeBlockLine[] | undefined;
	/** The language's name, shown in the header ("TypeScript"). */
	readonly language?: string | undefined;
	/** A line on what the code is ("auth.ts"), shown in the header. */
	readonly caption?: string | undefined;
	/** Shows a copy button; the caller copies `code` to the clipboard. */
	readonly onCopy?: (() => void) | undefined;
	/** The caller copied the code: the button shows a check and its `copied` name. */
	readonly copied?: boolean | undefined;
	/** Any of the block's names, in place of the defaults. */
	readonly labels?: Partial<CodeBlockLabels> | undefined;
	/** Numbers each line in a gutter beside the code (the web kit's `showLineNumbers`). */
	readonly showLineNumbers?: boolean | undefined;
	/** The first line's number (a file excerpt that starts at line 120). Default 1. */
	readonly startLine?: number | undefined;
	/** Lines to tint, by their number. */
	readonly lineMarks?: readonly CodeBlockLineMark[] | undefined;
	/** Wraps long lines instead of scrolling sideways. */
	readonly wrap?: boolean | undefined;
	/** Folds the block past this many lines, with a button that shows the rest. */
	readonly maxLines?: number | undefined;
	/** In the header in place of the language and caption: a title, file tabs, a search field. */
	readonly header?: React.ReactNode;
	/** In the header before the copy button: badges, actions. */
	readonly headerEnd?: React.ReactNode;
	/** Under the code: accept and reject, a status line. */
	readonly footer?: React.ReactNode;
	/** Lines to keep in focus: the others are dimmed (a walkthrough's step). */
	readonly focusLines?: readonly number[] | undefined;
	/** Lines shown as selected. */
	readonly selectedLines?: readonly number[] | undefined;
	/** Pressing a line's number (with `showLineNumbers`) reports the line: line selection. */
	readonly onLinePress?: ((line: number) => void) | undefined;
	/** Words or search matches to mark in the code. */
	readonly highlights?: readonly CodeHighlight[] | undefined;
	/** One-line notes under lines: diagnostics, suggestions. */
	readonly notes?: readonly CodeNote[] | undefined;
	/** Regions that fold, by their first and last line; their first line's number toggles them (with `showLineNumbers`). */
	readonly folds?: readonly CodeFold[] | undefined;
	/** The regions folded now, by their first line (controlled with `onFoldToggle`). */
	readonly folded?: readonly number[] | undefined;
	readonly onFoldToggle?: ((start: number) => void) | undefined;
	/** A gutter action on lines (with `showLineNumbers`). */
	readonly lineAction?: CodeBlockLineAction | undefined;
	readonly variant?: CodeBlockVariant | undefined;
	readonly size?: CodeBlockSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-2`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The code's lines: the caller's tokens, or each line of `code` as one plain token. */
function linesOf(code: string, lines: readonly CodeBlockLine[] | undefined): readonly CodeBlockLine[] {
	return lines ?? code.split("\n").map((line: string): CodeBlockLine => [{ text: line }]);
}

/** A line with no text still takes a line's height. */
const EMPTY_LINE = " ";

export const CodeBlock = React.memo(
	React.forwardRef<ViewInstance, CodeBlockProps>(function CodeBlock(
		{
			code,
			lines,
			language,
			caption,
			onCopy,
			copied = false,
			labels,
			showLineNumbers = false,
			startLine = 1,
			lineMarks,
			wrap = false,
			maxLines,
			header,
			headerEnd,
			footer,
			focusLines,
			selectedLines,
			onLinePress,
			highlights,
			notes,
			folds,
			folded,
			onFoldToggle,
			lineAction,
			variant = "muted",
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const names = React.useMemo((): CodeBlockLabels => ({ ...DEFAULT_CODE_BLOCK_LABELS, ...labels }), [labels]);
		const [expanded, setExpanded] = React.useState<boolean>(false);
		const allLines = React.useMemo((): readonly CodeBlockLine[] => linesOf(code, lines), [code, lines]);
		const marks = React.useMemo(
			(): ReadonlyMap<number, CodeBlockLineMarkKind> => new Map((lineMarks ?? []).map((mark: CodeBlockLineMark): [number, CodeBlockLineMarkKind] => [mark.line, mark.kind])),
			[lineMarks],
		);
		const foldable = maxLines !== undefined && allLines.length > maxLines;
		const shown = foldable && !expanded ? allLines.slice(0, maxLines) : allLines;
		const rows = React.useMemo(
			(): readonly CodeRow[] => codeRows(shown, startLine, notes ?? [], folds ?? [], new Set(folded ?? [])),
			[folded, folds, notes, shown, startLine],
		);
		const hasHeader = language !== undefined || caption !== undefined || onCopy !== undefined || header !== undefined || headerEnd !== undefined;
		const toggleFold = React.useCallback((): void => {
			setExpanded((open: boolean): boolean => !open);
		}, []);
		const foldState = React.useMemo((): { readonly expanded: boolean } => ({ expanded }), [expanded]);
		const textClass = codeBlockTextVariants({ size });
		const focus = focusLines === undefined ? null : new Set(focusLines);
		const selected = new Set(selectedLines ?? []);
		const foldStarts = new Map((folds ?? []).map((fold: CodeFold): [number, CodeFold] => [fold.start, fold]));
		const foldedStarts = new Set(folded ?? []);
		const gutterInteractive = onLinePress !== undefined || onFoldToggle !== undefined || lineAction !== undefined;
		const codeColumn = (
			<View className={codeBlockPaddingVariants({ size })} testID={testID === undefined ? undefined : `${testID}-code`}>
				{rows.map((row: CodeRow, index: number): React.JSX.Element => {
					if (row.kind === "note") {
						return <NoteRow key={`note-${String(row.number)}-${String(index)}`} note={row.note} textClass={textClass} />;
					}
					if (row.kind === "fold") {
						return (
							<FoldRow
								key={`fold-${String(row.number)}`}
								start={row.number}
								hidden={row.hidden}
								label={names.foldedLines(row.hidden)}
								onToggle={onFoldToggle}
								textClass={textClass}
							/>
						);
					}
					return (
						<CodeLineRow
							key={`line-${String(row.number)}`}
							line={row.line}
							mark={marks.get(row.number)}
							textClass={textClass}
							dim={focus === null ? false : !focus.has(row.number)}
							selected={selected.has(row.number)}
							highlights={highlights}
						/>
					);
				})}
			</View>
		);
		return (
			<View ref={ref} testID={testID} className={cn(codeBlockVariants({ variant }), className)}>
				{hasHeader ? (
					<View className="min-h-11 flex-row items-center gap-2 border-b border-border pl-4">
						<View className="flex-1 flex-row items-center gap-2">
							{header ?? (
								<>
									{language === undefined ? null : <Text className="text-caption font-mono text-muted-foreground uppercase">{language}</Text>}
									{caption === undefined ? null : (
										<Text numberOfLines={1} className="text-caption shrink font-sans text-muted-foreground">
											{caption}
										</Text>
									)}
								</>
							)}
						</View>
						{headerEnd}
						{onCopy === undefined ? null : <CodeBlockCopyButton copied={copied} labels={names} onCopy={onCopy} />}
					</View>
				) : null}
				<View className="flex-row">
					{showLineNumbers ? (
						<View
							className={codeBlockGutterVariants({ size })}
							// Plain numbers are never read out; a gutter with buttons (selection, folds, actions) must be reachable.
							accessibilityElementsHidden={!gutterInteractive}
							importantForAccessibility={gutterInteractive ? "auto" : "no-hide-descendants"}
							testID={testID === undefined ? undefined : `${testID}-line-numbers`}>
							{rows.map((row: CodeRow, index: number): React.JSX.Element =>
								row.kind === "line" ? (
									<GutterLine
										key={`line-${String(row.number)}`}
										number={row.number}
										mark={marks.get(row.number)}
										textClass={textClass}
										selected={selected.has(row.number)}
										fold={foldStarts.has(row.number) ? (foldedStarts.has(row.number) ? "closed" : "open") : null}
										onFoldToggle={onFoldToggle}
										onLinePress={onLinePress}
										action={lineAction !== undefined && (lineAction.lines === undefined || lineAction.lines.includes(row.number)) ? lineAction : undefined}
										labels={names}
									/>
								) : (
									<Text key={`${row.kind}-${String(row.number)}-${String(index)}`} className={textClass}>
										{EMPTY_LINE}
									</Text>
								),
							)}
						</View>
					) : null}
					{wrap ? (
						<View className="flex-1">{codeColumn}</View>
					) : (
						<ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" testID={testID === undefined ? undefined : `${testID}-scroll`}>
							{codeColumn}
						</ScrollView>
					)}
				</View>
				{footer === undefined ? null : <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border p-2">{footer}</View>}
				{foldable ? (
					<Pressable
						accessibilityRole="button"
						accessibilityState={foldState}
						accessibilityLabel={expanded ? names.collapse : names.expand(allLines.length)}
						onPress={toggleFold}
						className="active:bg-surface-selected min-h-11 flex-row items-center justify-center gap-2 border-t border-border">
						<Icon icon={expanded ? ChevronUpIcon : ChevronDownIcon} size="sm" colorClassName="accent-icon" />
						<Text className="text-label font-sans-medium text-muted-foreground">{expanded ? names.collapse : names.expand(allLines.length)}</Text>
					</Pressable>
				) : null}
			</View>
		);
	}),
);

interface CodeLineRowProps {
	readonly line: CodeBlockLine;
	readonly mark: CodeBlockLineMarkKind | undefined;
	readonly textClass: string;
	readonly dim: boolean;
	readonly selected: boolean;
	readonly highlights: readonly CodeHighlight[] | undefined;
}

/** The text of a line that is one plain token (uncoloured code), drawn without a nested span. */
function plainTextOf(line: CodeBlockLine): string | null {
	const [only, ...rest] = line;
	if (only === undefined) {
		return EMPTY_LINE;
	}
	return rest.length === 0 && (only.role ?? "plain") === "plain" ? only.text || EMPTY_LINE : null;
}

/** One line of code: selectable, its tokens in their roles' colours, tinted when marked or selected, dimmed out of focus. */
const CodeLineRow = React.memo(function CodeLineRow({ line, mark, textClass, dim, selected, highlights }: CodeLineRowProps): React.JSX.Element {
	const ranges = highlights === undefined ? [] : highlightRanges(line.map((token: CodeToken): string => token.text).join(""), highlights);
	const plain = ranges.length === 0 ? plainTextOf(line) : null;
	const tokens = markTokens(line, ranges);
	return (
		<Text
			selectable
			className={cn(textClass, mark === undefined ? undefined : codeLineMarkVariants({ kind: mark }), selected ? "bg-primary-subtle" : "", dim ? "opacity-40" : "")}>
			{plain ??
				tokens.map((token: MarkedToken, index: number): React.JSX.Element => (
					<Text
						key={`${String(index)}-${token.text}`}
						className={cn(codeTokenVariants({ role: token.role ?? "plain" }), token.highlight === undefined ? "" : codeHighlightVariants({ kind: token.highlight }))}>
						{token.text}
					</Text>
				))}
		</Text>
	);
});

const NOTE_CLASSES: Readonly<Record<NonNullable<CodeNote["kind"]>, string>> = {
	error: "text-destructive-foreground",
	warning: "text-tone-yellow",
	info: "text-muted-foreground",
};
const NOTE_SIGNS: Readonly<Record<NonNullable<CodeNote["kind"]>, string>> = { error: "✕", warning: "⚠", info: "ⓘ" };

/** A note under a line, one line tall, so the gutter stays level. */
function NoteRow({ note, textClass }: { readonly note: CodeNote; readonly textClass: string }): React.JSX.Element {
	const kind = note.kind ?? "info";
	return (
		<Text numberOfLines={1} className={cn(textClass, "font-sans", NOTE_CLASSES[kind])}>
			{`${NOTE_SIGNS[kind]} ${note.text}`}
		</Text>
	);
}

/** A folded region's row: how many lines it hides; pressing it unfolds them. */
function FoldRow({
	start,
	label,
	onToggle,
	textClass,
}: {
	readonly start: number;
	readonly hidden: number;
	readonly label: string;
	readonly onToggle: ((start: number) => void) | undefined;
	readonly textClass: string;
}): React.JSX.Element {
	const press = React.useCallback((): void => {
		onToggle?.(start);
	}, [onToggle, start]);
	return (
		<Text
			accessibilityRole={onToggle === undefined ? undefined : "button"}
			onPress={onToggle === undefined ? undefined : press}
			className={cn(textClass, "text-muted-foreground")}>
			{label}
		</Text>
	);
}

interface GutterLineProps {
	readonly number: number;
	readonly mark: CodeBlockLineMarkKind | undefined;
	readonly textClass: string;
	readonly selected: boolean;
	/** Whether the line starts a fold, and its state. */
	readonly fold: "open" | "closed" | null;
	readonly onFoldToggle: ((start: number) => void) | undefined;
	readonly onLinePress: ((line: number) => void) | undefined;
	readonly action: CodeBlockLineAction | undefined;
	readonly labels: CodeBlockLabels;
}

/** One line's number in the gutter, with its mark's sign; a fold toggle, a line action and line selection when offered. */
const GutterLine = React.memo(function GutterLine({ number, mark, textClass, selected, fold, onFoldToggle, onLinePress, action, labels }: GutterLineProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onFoldToggle?.(number);
	}, [number, onFoldToggle]);
	const press = React.useCallback((): void => {
		onLinePress?.(number);
	}, [number, onLinePress]);
	const act = React.useCallback((): void => {
		action?.onPress(number);
	}, [action, number]);
	const label = mark === undefined ? String(number) : `${LINE_MARK_SIGN[mark]} ${String(number)}`;
	const selectedState = { selected };
	return (
		<Text
			className={cn(
				textClass,
				"text-right text-muted-foreground",
				mark === undefined ? undefined : codeLineMarkVariants({ kind: mark }),
				selected ? "bg-primary-subtle text-foreground" : "",
			)}>
			{action === undefined ? null : (
				<Text accessibilityRole="button" accessibilityLabel={action.label(number)} onPress={act} className="text-primary">
					{`${action.sign} `}
				</Text>
			)}
			{fold === null || onFoldToggle === undefined ? null : (
				<Text accessibilityRole="button" accessibilityLabel={labels.toggleFold(number)} onPress={toggle}>
					{fold === "closed" ? "▸ " : "▾ "}
				</Text>
			)}
			{onLinePress === undefined ? (
				label
			) : (
				<Text accessibilityRole="button" accessibilityLabel={labels.selectLine(number)} accessibilityState={selectedState} onPress={press}>
					{label}
				</Text>
			)}
		</Text>
	);
});

interface CodeBlockCopyButtonProps {
	readonly copied: boolean;
	readonly labels: CodeBlockLabels;
	readonly onCopy: () => void;
}

const CodeBlockCopyButton = React.memo(function CodeBlockCopyButton({ copied, labels, onCopy }: CodeBlockCopyButtonProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={copied ? labels.copied : labels.copy}
			onPress={onCopy}
			className="size-11 items-center justify-center active:opacity-60">
			<Icon icon={copied ? CheckIcon : CopyIcon} size="sm" colorClassName={copied ? "accent-success" : "accent-muted-foreground"} />
		</Pressable>
	);
});
