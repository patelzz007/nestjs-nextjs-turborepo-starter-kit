// The web kit's `RichTextEditor` for a phone: a toolbar editor for what a broadcast may hold (headings, marks, https
// links, lists, quotes, code, a divider and one button), writing the same document JSON as the web's Tiptap editor
// (@workspace/shared `RichTextDocument`). A phone has no rich-text field, so each paragraph, heading, list item, quote
// line or code block is its own TextInput drawing its marked spans; the model in `lib/rich-text-editor.ts` turns each
// reported text into spans, splits a block at Enter and joins it to the one before at Backspace. Undo and Redo step
// through every change. Tables and images in a loaded document are shown and kept, not edited (edit them on the web).

import { HttpsLinkSchema, RICH_TEXT_MAX_CALLS_TO_ACTION, type RichTextDocument, type RichTextMark } from "@workspace/shared";
import BoldIcon from "lucide-react-native/icons/bold";
import CodeIcon from "lucide-react-native/icons/code";
import CodeXmlIcon from "lucide-react-native/icons/code-xml";
import Heading2Icon from "lucide-react-native/icons/heading-2";
import Heading3Icon from "lucide-react-native/icons/heading-3";
import ItalicIcon from "lucide-react-native/icons/italic";
import LinkIcon from "lucide-react-native/icons/link";
import ListIcon from "lucide-react-native/icons/list";
import ListOrderedIcon from "lucide-react-native/icons/list-ordered";
import MinusIcon from "lucide-react-native/icons/minus";
import MousePointerClickIcon from "lucide-react-native/icons/mouse-pointer-click";
import QuoteIcon from "lucide-react-native/icons/quote";
import Redo2Icon from "lucide-react-native/icons/redo-2";
import StrikethroughIcon from "lucide-react-native/icons/strikethrough";
import TrashIcon from "lucide-react-native/icons/trash-2";
import UnderlineIcon from "lucide-react-native/icons/underline";
import Undo2Icon from "lucide-react-native/icons/undo-2";
import { cva } from "class-variance-authority";
import * as React from "react";
import { ScrollView, Text, TextInput, View, type TextInputInstance, type TextInputKeyPressEvent, type TextInputSelectionChangeEvent, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import {
	applyTextEdit,
	blocksToDocument,
	blockText,
	createBlockIdFactory,
	documentToBlocks,
	isTextBlock,
	mapRangeMarks,
	marksAt,
	normalizeSpans,
	pushHistory,
	rangeHasMark,
	redoHistory,
	toggleMark,
	undoHistory,
	withMark,
	withoutMark,
	type EditorBlock,
	type EditorHistory,
	type EditorSpan,
	type EditorTextBlock,
	type PlainMarkType,
	type TextBlockKind,
	type TextRange,
} from "../lib/rich-text-editor";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import type { LucideIcon } from "./icon";
import { Input } from "./input";
import { RichTextView } from "./rich-text-view";
import { Toggle } from "./toggle";

export interface RichTextEditorLabels {
	readonly toolbar: string;
	readonly undo: string;
	readonly redo: string;
	readonly bold: string;
	readonly italic: string;
	readonly underline: string;
	readonly strike: string;
	readonly code: string;
	readonly link: string;
	readonly heading: string;
	readonly subheading: string;
	readonly bulletList: string;
	readonly orderedList: string;
	readonly quote: string;
	readonly codeBlock: string;
	readonly divider: string;
	readonly button: string;
	readonly linkTitle: string;
	readonly linkAddress: string;
	readonly invalidLink: string;
	readonly apply: string;
	readonly removeLink: string;
	readonly cancel: string;
	readonly buttonTitle: string;
	readonly buttonLabel: string;
	readonly buttonAddress: string;
	readonly insert: string;
	readonly removeBlock: (what: string) => string;
	readonly keptBlock: string;
}

export const richTextEditorVariants = cva("overflow-hidden rounded-lg border border-input bg-background");

export const DEFAULT_RICH_TEXT_EDITOR_LABELS: RichTextEditorLabels = {
	toolbar: "Formatting",
	undo: "Undo",
	redo: "Redo",
	bold: "Bold",
	italic: "Italic",
	underline: "Underline",
	strike: "Strikethrough",
	code: "Inline code",
	link: "Link",
	heading: "Heading",
	subheading: "Subheading",
	bulletList: "Bulleted list",
	orderedList: "Numbered list",
	quote: "Quote",
	codeBlock: "Code block",
	divider: "Divider",
	button: "Button",
	linkTitle: "Add a link",
	linkAddress: "Link address",
	invalidLink: "Links must be full https:// addresses.",
	apply: "Apply",
	removeLink: "Remove link",
	cancel: "Cancel",
	buttonTitle: "Add a button",
	buttonLabel: "Button text",
	buttonAddress: "Button link",
	insert: "Insert",
	removeBlock: (what: string): string => `Remove ${what}`,
	keptBlock: "Kept as it is: edit tables and images on the web.",
};

export interface RichTextEditorProps {
	/** The starting document; later changes of this value are not pushed into the editor. */
	readonly initialContent: RichTextDocument | null;
	/** Every change, as the stored document. */
	readonly onChange: (document: RichTextDocument) => void;
	/** The writing area's accessible name ("Message"). */
	readonly label: string;
	readonly placeholder?: string | undefined;
	/** A short toolbar: undo, marks, link and lists. */
	readonly compact?: boolean | undefined;
	readonly labels?: Partial<RichTextEditorLabels> | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const MARK_CLASSES: Readonly<Record<RichTextMark["type"], string>> = {
	bold: "font-sans-bold",
	italic: "italic",
	underline: "underline",
	strike: "line-through",
	code: "rounded bg-muted font-mono",
	link: "text-primary underline",
};

const KIND_CLASSES: Readonly<Record<TextBlockKind, string>> = {
	paragraph: "text-body font-sans text-foreground",
	heading2: "text-h3 font-heading text-foreground",
	heading3: "text-body-lg font-sans-semibold text-foreground",
	bullet: "text-body font-sans text-foreground",
	ordered: "text-body font-sans text-foreground",
	quote: "text-body font-sans italic text-muted-foreground",
	code: "font-mono text-label text-foreground",
};

/** Where the person is writing: the block, and the selected text in it (the cursor when `start` equals `end`). */
interface EditorFocus {
	readonly id: string;
	readonly range: TextRange;
}

interface BlockInputProps {
	readonly block: EditorTextBlock;
	readonly marker: string | null;
	readonly placeholder: string | undefined;
	readonly label: string;
	readonly onText: (id: string, text: string) => void;
	readonly onSelection: (id: string, range: TextRange) => void;
	readonly onBackspaceAtStart: (id: string) => void;
	readonly register: (id: string, input: TextInputInstance | null) => void;
	/** Where to put the cursor, once (after Enter or Backspace moved the writing here); `null` leaves it to the person. */
	readonly caret: number | null;
}

/** One text block: a TextInput drawing the block's spans, each with its marks' styles. */
function BlockInput({ block, marker, placeholder, label, onText, onSelection, onBackspaceAtStart, register, caret }: BlockInputProps): React.JSX.Element {
	const selection = React.useRef<TextRange>({ start: 0, end: 0 });
	const attach = React.useCallback(
		(input: TextInputInstance | null): void => {
			register(block.id, input);
		},
		[block.id, register],
	);
	const change = React.useCallback(
		(text: string): void => {
			onText(block.id, text);
		},
		[block.id, onText],
	);
	const select = React.useCallback(
		(event: TextInputSelectionChangeEvent): void => {
			selection.current = event.nativeEvent.selection;
			onSelection(block.id, event.nativeEvent.selection);
		},
		[block.id, onSelection],
	);
	const key = React.useCallback(
		(event: TextInputKeyPressEvent): void => {
			if (event.nativeEvent.key === "Backspace" && selection.current.start === 0 && selection.current.end === 0) {
				onBackspaceAtStart(block.id);
			}
		},
		[block.id, onBackspaceAtStart],
	);
	const focus = React.useCallback((): void => {
		onSelection(block.id, selection.current);
	}, [block.id, onSelection]);
	const placed = React.useMemo((): TextRange | undefined => (caret === null ? undefined : { start: caret, end: caret }), [caret]);
	return (
		<View className={cn("flex-row gap-2", block.kind === "quote" ? "border-l-2 border-border pl-3" : "", block.kind === "code" ? "rounded-lg bg-muted px-3 py-2" : "")}>
			{marker === null ? null : (
				<Text accessibilityElementsHidden importantForAccessibility="no" className="text-body min-w-5 font-sans text-muted-foreground">
					{marker}
				</Text>
			)}
			<TextInput
				ref={attach}
				multiline
				scrollEnabled={false}
				onChangeText={change}
				onSelectionChange={select}
				onKeyPress={key}
				onFocus={focus}
				selection={placed}
				placeholder={placeholder}
				accessibilityLabel={label}
				className={cn("flex-1 p-0", KIND_CLASSES[block.kind])}>
				{block.spans.map((span: EditorSpan, index: number): React.JSX.Element => (
					<Text key={`${String(index)}-${span.text}`} className={span.marks.map((mark: RichTextMark): string => MARK_CLASSES[mark.type]).join(" ")}>
						{span.text}
					</Text>
				))}
			</TextInput>
		</View>
	);
}

interface ToolProps {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly pressed: boolean;
	readonly disabled?: boolean | undefined;
	readonly value: string;
	readonly onPress: (value: string) => void;
}

/** A toolbar toggle that says whether its mark or block kind is on. */
function Tool({ label, icon, pressed, disabled = false, value, onPress }: ToolProps): React.JSX.Element {
	const change = React.useCallback((): void => {
		onPress(value);
	}, [onPress, value]);
	return <Toggle label={label} icon={icon} hideLabel pressed={pressed} onChange={change} disabled={disabled} size="sm" />;
}

const MARK_TOOLS: readonly { readonly type: PlainMarkType; readonly icon: LucideIcon; readonly label: (labels: RichTextEditorLabels) => string }[] = [
	{ type: "bold", icon: BoldIcon, label: (labels): string => labels.bold },
	{ type: "italic", icon: ItalicIcon, label: (labels): string => labels.italic },
	{ type: "underline", icon: UnderlineIcon, label: (labels): string => labels.underline },
	{ type: "strike", icon: StrikethroughIcon, label: (labels): string => labels.strike },
	{ type: "code", icon: CodeIcon, label: (labels): string => labels.code },
];

const KIND_TOOLS: readonly { readonly kind: TextBlockKind; readonly icon: LucideIcon; readonly label: (labels: RichTextEditorLabels) => string; readonly compact: boolean }[] =
	[
		{ kind: "heading2", icon: Heading2Icon, label: (labels): string => labels.heading, compact: false },
		{ kind: "heading3", icon: Heading3Icon, label: (labels): string => labels.subheading, compact: false },
		{ kind: "bullet", icon: ListIcon, label: (labels): string => labels.bulletList, compact: true },
		{ kind: "ordered", icon: ListOrderedIcon, label: (labels): string => labels.orderedList, compact: true },
		{ kind: "quote", icon: QuoteIcon, label: (labels): string => labels.quote, compact: false },
		{ kind: "code", icon: CodeXmlIcon, label: (labels): string => labels.codeBlock, compact: false },
	];

/** The marker before a list item: a bullet, or its number within its run of numbered items. */
function markerOf(blocks: readonly EditorBlock[], index: number): string | null {
	const block = blocks.at(index);
	if (block === undefined || !isTextBlock(block)) {
		return null;
	}
	if (block.kind === "bullet") {
		return "•";
	}
	if (block.kind !== "ordered") {
		return null;
	}
	let number = 1;
	for (let previous = index - 1; previous >= 0; previous -= 1) {
		const candidate = blocks.at(previous);
		if (candidate === undefined || !isTextBlock(candidate) || candidate.kind !== "ordered") {
			break;
		}
		number += 1;
	}
	return `${String(number)}.`;
}

type Sheet =
	| { readonly kind: "link"; readonly address: string; readonly error: string | null }
	| { readonly kind: "button"; readonly text: string; readonly address: string; readonly error: string | null }
	| null;

export const RichTextEditor = React.memo(
	React.forwardRef<ViewInstance, RichTextEditorProps>(function RichTextEditor(
		{ initialContent, onChange, label, placeholder, compact = false, labels: overrides, className, testID },
		ref,
	): React.JSX.Element {
		const labels: RichTextEditorLabels = { ...DEFAULT_RICH_TEXT_EDITOR_LABELS, ...overrides };
		const [nextId] = React.useState(() => createBlockIdFactory());
		const [history, setHistory] = React.useState<EditorHistory>(() => ({ past: [], present: documentToBlocks(initialContent, nextId), future: [] }));
		const [focus, setFocus] = React.useState<EditorFocus | null>(null);
		/** Marks toggled at a cursor with no text selected: what the next typed text takes. */
		const [pending, setPending] = React.useState<readonly RichTextMark[] | null>(null);
		const [sheet, setSheet] = React.useState<Sheet>(null);
		const inputs = React.useRef(new Map<string, TextInputInstance>());
		/** The block to focus once it is drawn (after Enter or Backspace moved the writing into another block). */
		const focusNext = React.useRef<string | null>(null);
		/** Where the cursor goes in that block. */
		const [caret, setCaret] = React.useState<{ readonly id: string; readonly offset: number } | null>(null);
		const blocks = history.present;

		React.useEffect((): void => {
			const target = focusNext.current;
			const input = target === null ? undefined : inputs.current.get(target);
			if (input !== undefined) {
				focusNext.current = null;
				input.focus();
			}
		}, [blocks]);
		const moveTo = React.useCallback((id: string, offset: number): void => {
			focusNext.current = id;
			setCaret({ id, offset });
		}, []);

		const commit = React.useCallback(
			(next: readonly EditorBlock[]): void => {
				setHistory((current) => pushHistory(current, next));
				onChange(blocksToDocument(next));
			},
			[onChange],
		);
		const register = React.useCallback((id: string, input: TextInputInstance | null): void => {
			if (input === null) {
				inputs.current.delete(id);
			} else {
				inputs.current.set(id, input);
			}
		}, []);

		const active = focus === null ? undefined : blocks.find((block): boolean => block.id === focus.id);
		const activeText = active !== undefined && isTextBlock(active) ? active : undefined;
		const range = React.useMemo((): TextRange => focus?.range ?? { start: 0, end: 0 }, [focus]);

		const onText = React.useCallback(
			(id: string, text: string): void => {
				const index = blocks.findIndex((block): boolean => block.id === id);
				const block = blocks.at(index);
				if (block === undefined || !isTextBlock(block)) {
					return;
				}
				const typing = pending ?? marksAt(block.spans, focus?.id === id ? focus.range.start : blockText(block).length);
				setPending(null);
				if (block.kind === "code") {
					commit(blocks.map((candidate): EditorBlock => (candidate.id === id ? { ...block, spans: text === "" ? [] : [{ text, marks: [] }] } : candidate)));
					return;
				}
				const edit = applyTextEdit(block.spans, text, typing);
				const listed = block.kind === "bullet" || block.kind === "ordered";
				if (listed && edit.spans.length === 0 && edit.lines.length === 1 && edit.lines.every((line): boolean => line.length === 0)) {
					// Enter on an empty list item ends the list: the item becomes a paragraph.
					commit(blocks.map((candidate): EditorBlock => (candidate.id === id ? { ...block, kind: "paragraph", spans: [] } : candidate)));
					return;
				}
				const continued: TextBlockKind = listed || block.kind === "quote" ? block.kind : "paragraph";
				const added = edit.lines.map((spans): EditorTextBlock => ({ id: nextId(), kind: continued, spans }));
				const last = added.at(-1);
				if (last !== undefined) {
					moveTo(last.id, 0);
				}
				commit([...blocks.slice(0, index), { ...block, spans: edit.spans }, ...added, ...blocks.slice(index + 1)]);
			},
			[blocks, commit, focus, moveTo, nextId, pending],
		);

		const onSelection = React.useCallback((id: string, selected: TextRange): void => {
			setFocus({ id, range: selected });
			setPending(null);
			setCaret(null);
		}, []);

		const onBackspaceAtStart = React.useCallback(
			(id: string): void => {
				const index = blocks.findIndex((block): boolean => block.id === id);
				const block = blocks.at(index);
				const previous = blocks.at(index - 1);
				if (block === undefined || !isTextBlock(block)) {
					return;
				}
				if (index === 0 || previous === undefined) {
					if (block.kind !== "paragraph") {
						commit(blocks.map((candidate): EditorBlock => (candidate.id === id ? { ...block, kind: "paragraph" } : candidate)));
					}
					return;
				}
				if (!isTextBlock(previous)) {
					commit(blocks.filter((candidate): boolean => candidate.id !== previous.id));
					return;
				}
				moveTo(previous.id, blockText(previous).length);
				commit([...blocks.slice(0, index - 1), { ...previous, spans: normalizeSpans([...previous.spans, ...block.spans]) }, ...blocks.slice(index + 1)]);
			},
			[blocks, commit, moveTo],
		);

		const toggleMarkType = React.useCallback(
			(value: string): void => {
				const type = MARK_TOOLS.find((tool): boolean => tool.type === value)?.type;
				if (type === undefined || activeText === undefined) {
					return;
				}
				if (range.start === range.end) {
					const current = pending ?? marksAt(activeText.spans, range.start);
					setPending(current.some((mark): boolean => mark.type === type) ? withoutMark(current, type) : withMark(current, { type }));
					return;
				}
				commit(blocks.map((block): EditorBlock => (block.id === activeText.id ? { ...activeText, spans: toggleMark(activeText.spans, range, type) } : block)));
			},
			[activeText, blocks, commit, pending, range],
		);

		const toggleKind = React.useCallback(
			(value: string): void => {
				const kind = KIND_TOOLS.find((tool): boolean => tool.kind === value)?.kind;
				if (kind === undefined || activeText === undefined) {
					return;
				}
				commit(blocks.map((block): EditorBlock => (block.id === activeText.id ? { ...activeText, kind: activeText.kind === kind ? "paragraph" : kind } : block)));
			},
			[activeText, blocks, commit],
		);

		const insertAfterActive = React.useCallback(
			(atom: EditorBlock): void => {
				const index = focus === null ? blocks.length - 1 : blocks.findIndex((block): boolean => block.id === focus.id);
				commit([...blocks.slice(0, index + 1), atom, ...blocks.slice(index + 1)]);
			},
			[blocks, commit, focus],
		);
		const insertDivider = React.useCallback((): void => {
			insertAfterActive({ id: nextId(), kind: "rule" });
		}, [insertAfterActive, nextId]);
		const removeBlock = React.useCallback(
			(id: string): void => {
				commit(blocks.filter((block): boolean => block.id !== id));
			},
			[blocks, commit],
		);

		const undo = React.useCallback((): void => {
			const next = undoHistory(history);
			setHistory(next);
			onChange(blocksToDocument(next.present));
		}, [history, onChange]);
		const redo = React.useCallback((): void => {
			const next = redoHistory(history);
			setHistory(next);
			onChange(blocksToDocument(next.present));
		}, [history, onChange]);

		// A selection's link is the one on its first character; at a cursor, the one on the text before it.
		const linkMark =
			activeText === undefined
				? undefined
				: marksAt(activeText.spans, range.start === range.end ? range.start : range.start + 1).find((mark): boolean => mark.type === "link");
		const openLink = React.useCallback((): void => {
			setSheet({ kind: "link", address: linkMark?.type === "link" ? linkMark.attrs.href : "https://", error: null });
		}, [linkMark]);
		const applyLink = React.useCallback((): void => {
			if (sheet?.kind !== "link" || activeText === undefined) {
				return;
			}
			if (!HttpsLinkSchema.safeParse(sheet.address).success) {
				setSheet({ ...sheet, error: labels.invalidLink });
				return;
			}
			const link: RichTextMark = { type: "link", attrs: { href: sheet.address } };
			commit(
				blocks.map((block): EditorBlock =>
					block.id === activeText.id ? { ...activeText, spans: mapRangeMarks(activeText.spans, range, (marks) => withMark(marks, link)) } : block,
				),
			);
			setSheet(null);
		}, [activeText, blocks, commit, labels.invalidLink, range, sheet]);
		const removeLink = React.useCallback((): void => {
			if (activeText !== undefined) {
				commit(
					blocks.map((block): EditorBlock =>
						block.id === activeText.id ? { ...activeText, spans: mapRangeMarks(activeText.spans, range, (marks) => withoutMark(marks, "link")) } : block,
					),
				);
			}
			setSheet(null);
		}, [activeText, blocks, commit, range]);

		const buttons = blocks.filter((block): boolean => block.kind === "button").length;
		const openButton = React.useCallback((): void => {
			setSheet({ kind: "button", text: "", address: "https://", error: null });
		}, []);
		const insertButton = React.useCallback((): void => {
			if (sheet?.kind !== "button") {
				return;
			}
			if (sheet.text.trim() === "" || !HttpsLinkSchema.safeParse(sheet.address).success) {
				setSheet({ ...sheet, error: labels.invalidLink });
				return;
			}
			insertAfterActive({ id: nextId(), kind: "button", label: sheet.text.trim(), href: sheet.address });
			setSheet(null);
		}, [insertAfterActive, labels.invalidLink, nextId, sheet]);
		const closeSheet = React.useCallback((): void => {
			setSheet(null);
		}, []);
		const setAddress = React.useCallback((address: string): void => {
			setSheet((current) => (current === null ? null : { ...current, address, error: null }));
		}, []);
		const setButtonText = React.useCallback((text: string): void => {
			setSheet((current) => (current?.kind === "button" ? { ...current, text, error: null } : current));
		}, []);

		const markOn = (type: PlainMarkType): boolean =>
			activeText !== undefined &&
			(range.start === range.end && pending !== null ? pending.some((mark): boolean => mark.type === type) : rangeHasMark(activeText.spans, range, type));
		const noSelection = activeText === undefined;
		const empty = blocks.length === 1 && blocks.every((block): boolean => isTextBlock(block) && block.spans.length === 0);

		return (
			<View ref={ref} className={cn(richTextEditorVariants(), className)} testID={testID}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					keyboardShouldPersistTaps="always"
					accessibilityRole="toolbar"
					accessibilityLabel={labels.toolbar}
					contentContainerClassName="items-center gap-1 border-b border-border px-2 py-1.5">
					<IconButton icon={Undo2Icon} label={labels.undo} onPress={undo} disabled={history.past.length === 0} variant="ghost" size="sm" />
					<IconButton icon={Redo2Icon} label={labels.redo} onPress={redo} disabled={history.future.length === 0} variant="ghost" size="sm" />
					{MARK_TOOLS.map((tool): React.JSX.Element => (
						<Tool
							key={tool.type}
							value={tool.type}
							label={tool.label(labels)}
							icon={tool.icon}
							pressed={markOn(tool.type)}
							disabled={noSelection || activeText.kind === "code"}
							onPress={toggleMarkType}
						/>
					))}
					<Tool value="link" label={labels.link} icon={LinkIcon} pressed={linkMark !== undefined} disabled={noSelection || activeText.kind === "code"} onPress={openLink} />
					{KIND_TOOLS.filter((tool): boolean => !compact || tool.compact).map((tool): React.JSX.Element => (
						<Tool
							key={tool.kind}
							value={tool.kind}
							label={tool.label(labels)}
							icon={tool.icon}
							pressed={activeText?.kind === tool.kind}
							disabled={noSelection}
							onPress={toggleKind}
						/>
					))}
					{compact ? null : (
						<>
							<IconButton icon={MinusIcon} label={labels.divider} onPress={insertDivider} variant="ghost" size="sm" />
							<IconButton
								icon={MousePointerClickIcon}
								label={labels.button}
								onPress={openButton}
								disabled={buttons >= RICH_TEXT_MAX_CALLS_TO_ACTION}
								variant="ghost"
								size="sm"
							/>
						</>
					)}
				</ScrollView>
				<View className="gap-3 p-3">
					{blocks.map((block, index: number): React.JSX.Element => {
						if (isTextBlock(block)) {
							return (
								<BlockInput
									key={block.id}
									block={block}
									marker={markerOf(blocks, index)}
									placeholder={empty ? placeholder : undefined}
									label={label}
									onText={onText}
									onSelection={onSelection}
									onBackspaceAtStart={onBackspaceAtStart}
									register={register}
									caret={caret?.id === block.id ? caret.offset : null}
								/>
							);
						}
						return <AtomBlock key={block.id} block={block} labels={labels} onRemove={removeBlock} />;
					})}
				</View>
				<BottomSheet visible={sheet?.kind === "link"} title={labels.linkTitle} onClose={closeSheet}>
					<View className="gap-3">
						<Input
							value={sheet?.address ?? ""}
							onChange={setAddress}
							accessibilityLabel={labels.linkAddress}
							keyboardType="url"
							autoCapitalize="none"
							invalid={sheet?.error != null}
						/>
						{sheet?.error == null ? null : <Text className="text-caption font-sans text-destructive">{sheet.error}</Text>}
						<View className="flex-row justify-end gap-2">
							{linkMark === undefined ? null : <Button label={labels.removeLink} variant="ghost" size="sm" onPress={removeLink} />}
							<Button label={labels.apply} size="sm" onPress={applyLink} disabled={range.start === range.end} />
						</View>
					</View>
				</BottomSheet>
				<BottomSheet visible={sheet?.kind === "button"} title={labels.buttonTitle} onClose={closeSheet}>
					<View className="gap-3">
						<Input value={sheet?.kind === "button" ? sheet.text : ""} onChange={setButtonText} accessibilityLabel={labels.buttonLabel} />
						<Input
							value={sheet?.address ?? ""}
							onChange={setAddress}
							accessibilityLabel={labels.buttonAddress}
							keyboardType="url"
							autoCapitalize="none"
							invalid={sheet?.error != null}
						/>
						{sheet?.error == null ? null : <Text className="text-caption font-sans text-destructive">{sheet.error}</Text>}
						<View className="flex-row justify-end gap-2">
							<Button label={labels.cancel} variant="ghost" size="sm" onPress={closeSheet} />
							<Button label={labels.insert} size="sm" onPress={insertButton} />
						</View>
					</View>
				</BottomSheet>
			</View>
		);
	}),
);

const NO_LINKS = (): void => undefined;

/** A divider, the button, or a kept block (a table, an image): shown, with a way to remove it. */
function AtomBlock({
	block,
	labels,
	onRemove,
}: {
	readonly block: Exclude<EditorBlock, EditorTextBlock>;
	readonly labels: RichTextEditorLabels;
	readonly onRemove: (id: string) => void;
}): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove(block.id);
	}, [block.id, onRemove]);
	const what = block.kind === "rule" ? labels.divider : block.kind === "button" ? labels.button : block.node.type;
	const document = React.useMemo((): RichTextDocument | null => (block.kind === "kept" ? { type: "doc", content: [block.node] } : null), [block]);
	return (
		<View className="flex-row items-center gap-2">
			<View className="flex-1">
				{block.kind === "rule" ? <View className="h-px bg-border" /> : null}
				{block.kind === "button" ? <Button label={block.label} size="sm" onPress={NO_LINKS} accessibilityHint={block.href} className="self-start" /> : null}
				{document === null ? null : (
					<View className="gap-1 rounded-lg border border-dashed border-border p-2">
						<RichTextView document={document} onOpenLink={NO_LINKS} />
						<Text className="text-caption font-sans text-muted-foreground">{labels.keptBlock}</Text>
					</View>
				)}
			</View>
			<IconButton icon={TrashIcon} label={labels.removeBlock(what)} onPress={remove} variant="ghost" size="sm" />
		</View>
	);
}
