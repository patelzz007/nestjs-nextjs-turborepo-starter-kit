import type * as React from "react";

import type { EmojiPickerEmoji } from "./data";

/* -------------------------------------------------------------------------- */
/*                                   Sizes                                    */
/* -------------------------------------------------------------------------- */

export type EmojiPickerSize = "sm" | "default" | "lg";

/* The panel's padding: the search, the tabs, the section names, the first
   column of glyphs and the preview all start this far in. */
export const EMOJI_PICKER_PADDING_PX = 8;

/** Rows the grid shows before it scrolls. */
export const EMOJI_PICKER_VISIBLE_ROWS = 7;

/** Rows rendered beyond each edge of the view, so a fast scroll never shows a gap. */
export const EMOJI_PICKER_OVERSCAN_ROWS = 4;

/** The most recent emoji remembered. */
export const EMOJI_PICKER_RECENT_CAP = 48;

/** Rows of recent emoji shown when `recentLimit` is not set. */
export const EMOJI_PICKER_DEFAULT_RECENT_ROWS = 2;

/** Cells per row when `columns` is not set (and before `"auto"` measures). */
export const EMOJI_PICKER_DEFAULT_COLUMNS = 8;

/* jsdom and an unmeasured first frame report 0; this keeps the window sane. */
export const EMOJI_PICKER_FALLBACK_HEIGHT_PX = 320;

/** Pixel geometry the virtual grid computes with. */
export interface EmojiPickerSizeTokens {
	readonly cell: number;
	readonly emoji: number;
	readonly header: number;
	readonly gutter: number;
}

interface SizeInput {
	readonly cellPx: number;
	readonly emojiPx: number;
	readonly headerPx: number;
}

/* Cells and headers are fixed-height on purpose: a measured row would cost a
   layout pass per row. Glyphs fill a bit over half their cell, so a dense grid
   still scans. The gutter is what is left of the padding once a cell's own
   slack is counted, so a hovered cell reaches past the padding the way a menu
   item does. */
function sizeOf({ cellPx, emojiPx, headerPx }: SizeInput): EmojiPickerSizeTokens {
	return { cell: cellPx, emoji: emojiPx, header: headerPx, gutter: EMOJI_PICKER_PADDING_PX - (cellPx - emojiPx) / 2 };
}

export const EMOJI_PICKER_SIZES: Readonly<Record<EmojiPickerSize, EmojiPickerSizeTokens>> = {
	sm: sizeOf({ cellPx: 26, emojiPx: 16, headerPx: 28 }),
	default: sizeOf({ cellPx: 30, emojiPx: 20, headerPx: 28 }),
	lg: sizeOf({ cellPx: 38, emojiPx: 26, headerPx: 32 }),
};

/* -------------------------------------------------------------------------- */
/*                                   Layout                                   */
/* -------------------------------------------------------------------------- */

export interface EmojiPickerSection {
	readonly id: string;
	readonly label: string;
	readonly emojis: readonly EmojiPickerEmoji[];
	readonly icon: React.ReactNode;
}

export interface LayoutSection {
	readonly section: EmojiPickerSection;
	readonly top: number;
	readonly height: number;
	readonly firstRow: number;
}

export interface LayoutRow {
	readonly section: number;
	readonly top: number;
	readonly cells: readonly EmojiPickerEmoji[];
}

export interface GridPosition {
	readonly row: number;
	readonly col: number;
}

export interface EmojiPickerLayout {
	readonly sections: readonly LayoutSection[];
	readonly rows: readonly LayoutRow[];
	readonly height: number;
	readonly positions: ReadonlyMap<string, GridPosition>;
}

/** The key of one cell: a section id and an emoji id (an emoji may sit in two sections). */
export function cellKey(section: string, id: string): string {
	return `${section}\u0000${id}`;
}

/** Places every section's header and rows at fixed offsets. */
export function buildLayout(sections: readonly EmojiPickerSection[], columns: number, size: EmojiPickerSizeTokens): EmojiPickerLayout {
	const layoutSections: LayoutSection[] = [];
	const rows: LayoutRow[] = [];
	const positions = new Map<string, GridPosition>();
	let top = 0;
	sections.forEach((section: EmojiPickerSection, index: number): void => {
		const firstRow = rows.length;
		const count = Math.ceil(section.emojis.length / columns);
		for (let row = 0; row < count; row += 1) {
			const cells = section.emojis.slice(row * columns, (row + 1) * columns);
			const rowIndex = rows.length;
			cells.forEach((emoji: EmojiPickerEmoji, col: number): void => {
				positions.set(cellKey(section.id, emoji.id), { row: rowIndex, col });
			});
			rows.push({ section: index, top: top + size.header + row * size.cell, cells });
		}
		const height = size.header + count * size.cell;
		layoutSections.push({ section, top, height, firstRow });
		top += height;
	});
	return { sections: layoutSections, rows, height: top + size.gutter, positions };
}

/** The last item whose top is at or above `offset` (binary search). */
export function indexAt(items: readonly { readonly top: number }[], offset: number): number {
	let low = 0;
	let high = items.length - 1;
	let found = 0;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const item = items[middle];
		if (item !== undefined && item.top <= offset) {
			found = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	return found;
}

/* -------------------------------------------------------------------------- */
/*                                 Navigation                                 */
/* -------------------------------------------------------------------------- */

export type EmojiPickerMove = "next" | "prev" | "up" | "down" | "pageUp" | "pageDown" | "first" | "last" | "visible";

export interface MoveInput {
	readonly layout: EmojiPickerLayout;
	readonly at: GridPosition | undefined;
	readonly to: EmojiPickerMove;
	/** The grid's scroll offset, for `"visible"`. */
	readonly scrollTop: number;
	readonly headerPx: number;
	readonly pageRows: number;
	/** The column Up and Down aim for, kept across a shorter row. */
	readonly goalColumn: number | null;
	/** A search is showing: Up from the top row stays in the grid. */
	readonly searching: boolean;
}

export type MoveResult =
	/** Up from the top row hands the arrows back to the search caret. */
	| { readonly kind: "release" }
	| { readonly kind: "cell"; readonly position: GridPosition; readonly sectionId: string; readonly emojiId: string; readonly goalColumn: number | null };

function rowLength(rows: readonly LayoutRow[], row: number): number {
	return rows[row]?.cells.length ?? 0;
}

function isVertical(to: EmojiPickerMove): boolean {
	return to === "up" || to === "down" || to === "pageUp" || to === "pageDown";
}

/* With nothing highlighted, the keyboard starts at the first row in view under
   the sticky header, so it picks up after a category jump. */
function firstVisibleRow(input: MoveInput): number {
	const { rows } = input.layout;
	const offset = input.scrollTop + input.headerPx - 1;
	const row = indexAt(rows, offset);
	const top = rows[row]?.top ?? 0;
	return top < offset && row + 1 < rows.length ? row + 1 : row;
}

interface Step {
	readonly row: number;
	readonly col: number;
}

function stepFrom(input: MoveInput, at: GridPosition): Step | null {
	const { rows } = input.layout;
	const col = isVertical(input.to) ? (input.goalColumn ?? at.col) : at.col;
	const lastRow = rows.length - 1;
	switch (input.to) {
		case "next":
			if (col + 1 < rowLength(rows, at.row)) {
				return { row: at.row, col: col + 1 };
			}
			return at.row + 1 < rows.length ? { row: at.row + 1, col: 0 } : { row: at.row, col };
		case "prev":
			if (col > 0) {
				return { row: at.row, col: col - 1 };
			}
			return at.row > 0 ? { row: at.row - 1, col: rowLength(rows, at.row - 1) - 1 } : { row: at.row, col };
		case "down":
			return { row: Math.min(at.row + 1, lastRow), col };
		case "pageDown":
			return { row: Math.min(at.row + input.pageRows, lastRow), col };
		case "pageUp":
			return { row: Math.max(at.row - input.pageRows, 0), col };
		case "up":
			if (at.row === 0 && !input.searching) {
				return null;
			}
			return { row: Math.max(at.row - 1, 0), col };
		case "first":
		case "last":
		case "visible":
			return { row: at.row, col };
		default:
			return assertNeverMove(input.to);
	}
}

function assertNeverMove(value: never): never {
	throw new Error(`Unhandled emoji picker move: ${String(value)}`);
}

/** Where the highlight lands after one keyboard move. `null` when the grid is empty. */
export function moveActiveCell(input: MoveInput): MoveResult | null {
	const { rows, sections } = input.layout;
	if (rows.length === 0) {
		return null;
	}
	const to = input.at === undefined && input.to !== "first" && input.to !== "last" ? "visible" : input.to;
	let row = 0;
	let col = 0;
	let goalColumn: number | null = null;
	if (to === "visible") {
		row = firstVisibleRow(input);
	} else if (to === "last") {
		row = rows.length - 1;
		col = rowLength(rows, row) - 1;
	} else if (to !== "first" && input.at !== undefined) {
		const step = stepFrom({ ...input, to }, input.at);
		if (step === null) {
			return { kind: "release" };
		}
		row = step.row;
		goalColumn = isVertical(to) ? step.col : null;
		col = Math.min(step.col, rowLength(rows, row) - 1);
	}
	const layoutRow = rows[row];
	const cell = layoutRow?.cells[col];
	const section = layoutRow === undefined ? undefined : sections[layoutRow.section];
	if (cell === undefined || section === undefined) {
		return null;
	}
	return { kind: "cell", position: { row, col }, sectionId: section.section.id, emojiId: cell.id, goalColumn };
}
