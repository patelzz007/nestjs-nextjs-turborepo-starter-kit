"use client";

import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { EMOJI_PICKER_SEARCH_ICON, EmojiGlyph, emojiPickerOptionId, useEmojiPickerContext, type EmojiPickerContextValue } from "@workspace/ui/components/emoji-picker-context";
import { isTouchScreen } from "@workspace/ui/components/emoji-picker-state";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import type { EmojiPickerEmoji } from "@workspace/ui/lib/emoji-picker/data";
import {
	EMOJI_PICKER_FALLBACK_HEIGHT_PX,
	EMOJI_PICKER_OVERSCAN_ROWS,
	EMOJI_PICKER_VISIBLE_ROWS,
	indexAt,
	type GridPosition,
	type LayoutSection,
} from "@workspace/ui/lib/emoji-picker/layout";
import { getEmojiValue } from "@workspace/ui/lib/emoji-picker/search";
import * as React from "react";

/** Rows of placeholder bones while the data loads. */
const SKELETON_ROWS = 5;

/** A scroll within this many px of where the grid scrolled itself is the grid's own. */
const SELF_SCROLL_TOLERANCE_PX = 1;

/* The group heading, at a fixed height so the virtual grid can place rows
   without measuring. The text starts where the glyphs below it do. */
const SECTION_HEADER_CLASS =
	"sticky top-0 z-1 flex h-(--emoji-picker-header) items-center bg-(--emoji-picker-surface) px-(--emoji-picker-padding) pt-1 text-xs font-medium text-muted-foreground select-none";

/* A cell is a ghost icon button: a highlight paints its background only; the
   glyph never changes size. */
const CELL_CLASS =
	"mx-auto flex size-(--emoji-picker-cell) cursor-default items-center justify-center rounded-md text-(length:--emoji-picker-emoji) transition-colors duration-100 select-none data-active:bg-muted aria-disabled:opacity-40 data-selected:bg-primary/10 data-selected:inset-ring-1 data-selected:inset-ring-primary/30 dark:data-selected:bg-primary/20 forced-colors:data-active:outline-2 forced-colors:data-active:outline-solid";

/* The keyboard's cell takes the Button's focus border and ring, the ring no
   wider than the gutter so the grid's edge never cuts it. */
const CELL_FOCUS_CLASS =
	"data-keyboard:z-2 data-keyboard:border data-keyboard:border-ring data-keyboard:ring-[length:min(3px,var(--emoji-picker-gutter))] data-keyboard:ring-ring/50";

/* No scrollbar; a fade at each end that has rows scrolled out of view says
   there is more. The top fade starts under the sticky header, which stays
   solid. `--emoji-picker-fade-size` sets the depth, `0px` turns it off, as the
   keyboard does: a mask also fades the focus ring it would sit on. */
const LIST_CLASS =
	"relative h-(--emoji-picker-list-height) min-h-[calc(var(--emoji-picker-header)+var(--emoji-picker-cell)*2)] overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] data-keyboard:[--emoji-picker-fade-size:0px] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,black_var(--emoji-picker-header),transparent_var(--emoji-picker-header),black_calc(var(--emoji-picker-header)+var(--emoji-picker-fade-start,0px)),black_calc(100%-var(--emoji-picker-fade-end,0px)),transparent)] data-overflow-start:[--emoji-picker-fade-start:var(--emoji-picker-fade-size,calc(var(--emoji-picker-cell)*2/3))] data-overflow-end:[--emoji-picker-fade-end:var(--emoji-picker-fade-size,calc(var(--emoji-picker-cell)*2/3))]";

/* Scrolls the grid and notes where, so a scroll of its own is told from the user's. */
function scrollGrid(list: HTMLElement, top: number, mark: React.RefObject<number | null>): void {
	list.scrollTop = top;
	mark.current = list.scrollTop;
}

interface RowRange {
	readonly start: number;
	readonly end: number;
}

const INITIAL_RANGE: RowRange = { start: 0, end: EMOJI_PICKER_VISIBLE_ROWS + EMOJI_PICKER_OVERSCAN_ROWS };

/** The rows to render, by section: the window plus the highlighted row (so `aria-activedescendant` resolves). */
function renderedRowsBySection(context: EmojiPickerContextValue, range: RowRange): Map<number, number[]> {
	const { layout, activePosition } = context;
	const rendered = new Set<number>();
	for (let row = range.start; row <= range.end && row < layout.rows.length; row += 1) {
		rendered.add(row);
	}
	if (activePosition !== undefined) {
		rendered.add(activePosition.row);
	}
	const rowsBySection = new Map<number, number[]>();
	for (const row of [...rendered].sort((left: number, right: number): number => left - right)) {
		const section = layout.rows[row]?.section;
		if (section === undefined) {
			continue;
		}
		const list = rowsBySection.get(section);
		if (list === undefined) {
			rowsBySection.set(section, [row]);
		} else {
			list.push(row);
		}
	}
	return rowsBySection;
}

interface EmojiPickerCellProps {
	readonly emoji: EmojiPickerEmoji;
	readonly sectionId: string;
	readonly position: GridPosition;
	readonly posInSet: number;
	readonly setSize: number;
	readonly isKeyboard: boolean;
	readonly onPointerFocus: () => void;
}

function EmojiPickerCell({ emoji, sectionId, position, posInSet, setSize, isKeyboard, onPointerFocus }: EmojiPickerCellProps): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerList");
	const { activePosition, searchRef, listRef } = context;
	const isActive = activePosition?.row === position.row && activePosition.col === position.col;
	const isSelected = context.isSelected(emoji);
	const isRefused = context.full && !isSelected;
	const value = getEmojiValue(emoji, emoji.skins === undefined ? 0 : context.skinTone);

	/* Keeps focus in the search, so typing goes on. A panel that does not hold
	   focus yet takes it there, or on the list on a touch screen, where the
	   search would raise the keyboard. */
	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			event.preventDefault();
			const search = searchRef.current;
			const list = listRef.current;
			const focused = event.currentTarget.ownerDocument.activeElement;
			if (focused === search || focused === list) {
				return;
			}
			const target = event.pointerType === "touch" ? list : (search ?? list);
			if (target === list) {
				onPointerFocus();
			}
			target?.focus({ preventScroll: true });
		},
		[listRef, searchRef, onPointerFocus],
	);

	const handlePointerMove = React.useCallback((): void => {
		if (isActive && context.active?.source === "pointer") {
			return;
		}
		context.setActive({ section: sectionId, id: emoji.id, source: "pointer" });
	}, [context, emoji.id, isActive, sectionId]);

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			if (!isRefused) {
				context.pick(emoji, event);
			}
		},
		[context, emoji, isRefused],
	);

	return (
		<div
			id={emojiPickerOptionId(context.listId, position)}
			role="option"
			tabIndex={-1}
			aria-label={context.labels.formatLabel(emoji.label)}
			aria-selected={context.valueMode ? isSelected : isActive}
			aria-disabled={isRefused ? true : undefined}
			aria-posinset={posInSet}
			aria-setsize={setSize}
			data-slot="emoji-picker-emoji"
			data-active={isActive ? "" : undefined}
			data-keyboard={isKeyboard && isActive ? "" : undefined}
			data-selected={isSelected && context.valueMode ? "true" : undefined}
			className={cn(CELL_CLASS, CELL_FOCUS_CLASS)}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onClick={handleClick}>
			<EmojiGlyph emoji={emoji} value={value} />
		</div>
	);
}

interface EmojiPickerGridSectionProps {
	readonly section: LayoutSection;
	readonly sectionIndex: number;
	readonly rows: readonly number[];
	readonly isKeyboard: boolean;
	readonly onPointerFocus: () => void;
}

function EmojiPickerGridSection({ section, sectionIndex, rows, isKeyboard, onPointerFocus }: EmojiPickerGridSectionProps): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerList");
	const headerId = `${context.listId}-${String(sectionIndex)}`;
	const sectionStyle = React.useMemo((): React.CSSProperties => ({ top: section.top, height: section.height }), [section.top, section.height]);
	return (
		<div role="group" aria-labelledby={headerId} data-slot="emoji-picker-section" data-section={section.section.id} className="absolute inset-x-0" style={sectionStyle}>
			<div id={headerId} data-slot="emoji-picker-section-header" className={SECTION_HEADER_CLASS}>
				{section.section.label}
			</div>
			{rows.map((rowIndex: number): React.JSX.Element | null => {
				const row = context.layout.rows[rowIndex];
				if (row === undefined) {
					return null;
				}
				const first = (rowIndex - section.firstRow) * context.columnCount;
				return (
					<EmojiPickerGridRow key={rowIndex} top={row.top - section.top}>
						{row.cells.map((emoji: EmojiPickerEmoji, col: number): React.JSX.Element => (
							<EmojiPickerCell
								key={emoji.id}
								emoji={emoji}
								sectionId={section.section.id}
								position={{ row: rowIndex, col }}
								posInSet={first + col + 1}
								setSize={section.section.emojis.length}
								isKeyboard={isKeyboard}
								onPointerFocus={onPointerFocus}
							/>
						))}
					</EmojiPickerGridRow>
				);
			})}
		</div>
	);
}

interface EmojiPickerGridRowProps {
	readonly top: number;
	readonly children: React.ReactNode;
}

function EmojiPickerGridRow({ top, children }: EmojiPickerGridRowProps): React.JSX.Element {
	const style = React.useMemo((): React.CSSProperties => ({ top }), [top]);
	return (
		<div role="presentation" className="absolute inset-x-(--emoji-picker-gutter) grid grid-cols-[repeat(var(--emoji-picker-columns),minmax(0,1fr))]" style={style}>
			{children}
		</div>
	);
}

function EmojiPickerListSkeleton({ columnCount, label }: { readonly columnCount: number; readonly label: string }): React.JSX.Element {
	const boneIds = React.useMemo(
		(): string[] => Array.from({ length: columnCount * SKELETON_ROWS }, (_bone: undefined, index: number): string => `bone-${String(index)}`),
		[columnCount],
	);
	return (
		<div role="status" aria-label={label} className="flex flex-col">
			<div className="flex h-(--emoji-picker-header) items-center px-(--emoji-picker-padding) pt-1">
				<Skeleton className="h-3 w-24" />
			</div>
			<div className="grid grid-cols-[repeat(var(--emoji-picker-columns),minmax(0,1fr))] px-(--emoji-picker-gutter)">
				{boneIds.map((boneId: string): React.JSX.Element => (
					<div key={boneId} className="flex size-(--emoji-picker-cell) items-center justify-center">
						<Skeleton className="size-(--emoji-picker-emoji) rounded-full" />
					</div>
				))}
			</div>
		</div>
	);
}

export type EmojiPickerListProps = React.ComponentProps<"div">;

/**
 * The virtual grid: only the rows in view render, so a page of reaction
 * pickers or a 20,000 custom emoji library stays cheap. Section headers stick
 * while their rows scroll. Holds the loading, error and empty states.
 */
export const EmojiPickerList = React.forwardRef<HTMLDivElement, EmojiPickerListProps>(function EmojiPickerList(
	{ className, onKeyDown, onFocus, onBlur, onPointerDown, onScroll, ...props },
	ref,
): React.JSX.Element {
	const context = useEmojiPickerContext("EmojiPickerList");
	const { layout, size, requestData, setActiveSection, setMeasuredColumns, setJump, listRef, jump, active, activePosition, columns, labels, setPageRows } = context;
	const [range, setRange] = React.useState<RowRange>(INITIAL_RANGE);
	const updateRef = React.useRef((): void => undefined);
	/* A click on the grid's own background focuses it without a highlight. */
	const pointerDown = React.useRef(false);
	/* Where the grid last scrolled itself; any other scroll is the user's. */
	const scrolledTo = React.useRef<number | null>(null);

	const update = React.useCallback((): void => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		const height = list.clientHeight === 0 ? EMOJI_PICKER_FALLBACK_HEIGHT_PX : list.clientHeight;
		const top = list.scrollTop;
		const last = Math.max(0, layout.rows.length - 1);
		const start = Math.max(0, indexAt(layout.rows, top) - EMOJI_PICKER_OVERSCAN_ROWS);
		const end = Math.min(last, indexAt(layout.rows, top + height) + EMOJI_PICKER_OVERSCAN_ROWS);
		setRange((previous: RowRange): RowRange => (previous.start === start && previous.end === end ? previous : { start, end }));
		setPageRows(Math.max(1, Math.floor((height - size.header) / size.cell)));
		list.toggleAttribute("data-overflow-start", top > SELF_SCROLL_TOLERANCE_PX);
		list.toggleAttribute("data-overflow-end", top + list.clientHeight < list.scrollHeight - SELF_SCROLL_TOLERANCE_PX);
		setActiveSection(layout.sections[indexAt(layout.sections, top + 1)]?.section.id ?? null);
	}, [layout, listRef, setActiveSection, setPageRows, size.cell, size.header]);

	React.useLayoutEffect((): void => {
		updateRef.current = update;
	});

	React.useEffect((): void => {
		requestData();
	}, [requestData]);

	/* A new query starts at the top. */
	React.useLayoutEffect((): void => {
		if (listRef.current !== null) {
			scrollGrid(listRef.current, 0, scrolledTo);
		}
		updateRef.current();
	}, [context.query, listRef]);

	React.useLayoutEffect((): void => {
		updateRef.current();
	}, [layout]);

	React.useLayoutEffect((): void => {
		const list = listRef.current;
		if (jump === null || list === null) {
			return;
		}
		const section = layout.sections.find((item: LayoutSection): boolean => item.section.id === jump);
		if (section === undefined) {
			return;
		}
		scrollGrid(list, section.top, scrolledTo);
		updateRef.current();
		setJump(null);
	}, [jump, layout, listRef, setJump]);

	/* Keeps a keyboard-highlighted cell clear of the sticky header and the
	   bottom edge. A hovered one is already in view. */
	React.useLayoutEffect((): void => {
		const list = listRef.current;
		if (list === null || active?.source !== "keyboard" || activePosition === undefined) {
			return;
		}
		const row = layout.rows[activePosition.row];
		if (row === undefined) {
			return;
		}
		const height = list.clientHeight === 0 ? EMOJI_PICKER_FALLBACK_HEIGHT_PX : list.clientHeight;
		if (row.top - size.header < list.scrollTop) {
			scrollGrid(list, row.top - size.header, scrolledTo);
		} else if (row.top + size.cell + size.gutter > list.scrollTop + height) {
			scrollGrid(list, row.top + size.cell + size.gutter - height, scrolledTo);
		}
		updateRef.current();
	}, [active, activePosition, layout, listRef, size]);

	/* Re-reads the window and the fades on resize and, under
	   `columns="auto"`, how many cells fit. */
	React.useLayoutEffect((): (() => void) | undefined => {
		const list = listRef.current;
		if (list === null) {
			return undefined;
		}
		const measure = (): void => {
			if (columns === "auto" && list.clientWidth > 0) {
				setMeasuredColumns(Math.max(1, Math.floor((list.clientWidth - size.gutter * 2) / size.cell)));
			}
			updateRef.current();
		};
		measure();
		if (!hasResizeObserver()) {
			return undefined;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return (): void => {
			observer.disconnect();
		};
	}, [columns, listRef, setMeasuredColumns, size]);

	const markPointerFocus = React.useCallback((): void => {
		pointerDown.current = true;
	}, []);

	const handleScroll = React.useCallback(
		(event: React.UIEvent<HTMLDivElement>): void => {
			onScroll?.(event);
			const mark = scrolledTo.current;
			if (mark === null || Math.abs(event.currentTarget.scrollTop - mark) > SELF_SCROLL_TOLERANCE_PX) {
				context.releaseKeyboard();
			}
			update();
		},
		[context, onScroll, update],
	);

	const handlePointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			onPointerDown?.(event);
			if (!event.defaultPrevented) {
				pointerDown.current = true;
			}
		},
		[onPointerDown],
	);

	const handleFocus = React.useCallback(
		(event: React.FocusEvent<HTMLDivElement>): void => {
			onFocus?.(event);
			context.setFocused(true);
			if (event.target !== event.currentTarget) {
				return;
			}
			const fromPointer = pointerDown.current || isTouchScreen();
			pointerDown.current = false;
			/* Tabbing in starts at the first emoji in view; a highlight the
			   keyboard already holds stays where it is. */
			if (!fromPointer && context.active?.source !== "keyboard") {
				context.move("visible");
			}
		},
		[context, onFocus],
	);

	const handleBlur = React.useCallback(
		(event: React.FocusEvent<HTMLDivElement>): void => {
			onBlur?.(event);
			pointerDown.current = false;
			context.setFocused(false);
		},
		[context, onBlur],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDown?.(event);
			if (event.defaultPrevented || event.target !== event.currentTarget) {
				return;
			}
			/* Typing in the grid goes on in the search. */
			const search = context.searchRef.current;
			const isTyped = (event.key.length === 1 && event.key !== " ") || event.key === "Backspace";
			if (search !== null && isTyped && !event.nativeEvent.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey) {
				search.focus();
				return;
			}
			context.navigate(event, false);
		},
		[context, onKeyDown],
	);

	const mergedRef = React.useMemo((): React.RefCallback<HTMLDivElement> => mergeRefs(listRef, ref), [listRef, ref]);
	const heightStyle = React.useMemo((): React.CSSProperties => ({ height: layout.height }), [layout.height]);

	const rowsBySection = renderedRowsBySection(context, range);
	const isSearching = context.query.trim() !== "";
	const isReady = context.status === "ready";
	const isEmpty = isReady && layout.rows.length === 0;
	/* The keyboard's highlight shows only while the search or the grid holds
	   focus, and pauses the fades. */
	const isKeyboard = context.focused && active?.source === "keyboard" && activePosition !== undefined;
	const resultCount = layout.rows.reduce((sum: number, row: { readonly cells: readonly EmojiPickerEmoji[] }): number => sum + row.cells.length, 0);
	const status = isSearching && isReady ? labels.formatResultCount(resultCount) : "";

	return (
		<>
			<div
				ref={mergedRef}
				id={context.listId}
				role="listbox"
				aria-label={labels.list}
				aria-multiselectable={context.multiple ? true : undefined}
				aria-busy={isReady ? undefined : true}
				aria-activedescendant={activePosition === undefined ? undefined : emojiPickerOptionId(context.listId, activePosition)}
				/* A tab stop of its own, search or not, once there is an emoji. */
				tabIndex={context.disabled || !isReady || isEmpty ? -1 : 0}
				data-slot="emoji-picker-list"
				data-keyboard={isKeyboard ? "" : undefined}
				className={cn(LIST_CLASS, className)}
				onScroll={handleScroll}
				onPointerDown={handlePointerDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				{...props}>
				{isReady ? (
					<div className="relative" style={heightStyle}>
						{layout.sections.map((section: LayoutSection, sectionIndex: number): React.JSX.Element | null => {
							const rows = rowsBySection.get(sectionIndex);
							return rows === undefined ? null : (
								<EmojiPickerGridSection
									key={section.section.id}
									section={section}
									sectionIndex={sectionIndex}
									rows={rows}
									isKeyboard={isKeyboard}
									onPointerFocus={markPointerFocus}
								/>
							);
						})}
					</div>
				) : null}
				{!isReady && context.status !== "error" ? <EmojiPickerListSkeleton columnCount={context.columnCount} label={labels.loading} /> : null}
				{context.status === "error" ? (
					<Empty className="h-full">
						<EmptyHeader>
							<EmptyTitle>{labels.error}</EmptyTitle>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" variant="outline" size="sm" onClick={context.retry}>
								{labels.retry}
							</Button>
						</EmptyContent>
					</Empty>
				) : null}
				{isEmpty ? (
					<Empty data-slot="emoji-picker-empty" className="h-full">
						<EmptyHeader>
							<EmptyMedia variant="icon">{EMOJI_PICKER_SEARCH_ICON}</EmptyMedia>
							<EmptyTitle>{labels.empty}</EmptyTitle>
							<EmptyDescription>{labels.emptyHint}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}
			</div>
			<div role="status" aria-live="polite" className="sr-only">
				{context.announcement === "" ? status : context.announcement}
			</div>
		</>
	);
});

function hasResizeObserver(): boolean {
	return hasGlobalConstructor("ResizeObserver");
}
