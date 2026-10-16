import { describe, expect, it } from "vitest";

import type { EmojiPickerEmoji } from "./data";
import { buildLayout, cellKey, EMOJI_PICKER_SIZES, indexAt, moveActiveCell, type EmojiPickerLayout, type EmojiPickerSection, type MoveInput } from "./layout";

function emoji(id: string): EmojiPickerEmoji {
	return { id, emoji: id, label: id, tags: [], shortcodes: [], category: "smileys", version: 1 };
}

const SIZE = EMOJI_PICKER_SIZES.default;
const SECTIONS: readonly EmojiPickerSection[] = [
	{ id: "a", label: "A", emojis: ["a1", "a2", "a3", "a4", "a5"].map(emoji), icon: null },
	{ id: "b", label: "B", emojis: ["b1", "b2"].map(emoji), icon: null },
];
const LAYOUT: EmojiPickerLayout = buildLayout(SECTIONS, 3, SIZE);

function moveInput(overrides: Partial<MoveInput>): MoveInput {
	return { layout: LAYOUT, at: { row: 0, col: 0 }, to: "next", scrollTop: 0, headerPx: SIZE.header, pageRows: 2, goalColumn: null, searching: false, ...overrides };
}

describe("EMOJI_PICKER_SIZES", () => {
	it("derives the gutter from the padding and the cell's slack", (): void => {
		expect(EMOJI_PICKER_SIZES.default).toStrictEqual({ cell: 30, emoji: 20, header: 28, gutter: 3 });
		expect(EMOJI_PICKER_SIZES.sm.gutter).toBe(3);
		expect(EMOJI_PICKER_SIZES.lg.gutter).toBe(2);
	});
});

describe("buildLayout", () => {
	it("places headers and rows at fixed offsets", (): void => {
		expect(LAYOUT.rows.map((row): number => row.top)).toStrictEqual([28, 58, 116]);
		expect(LAYOUT.rows.map((row): number => row.cells.length)).toStrictEqual([3, 2, 2]);
		expect(LAYOUT.sections.map((section): number => section.top)).toStrictEqual([0, 88]);
		expect(LAYOUT.height).toBe(88 + 58 + SIZE.gutter);
		expect(LAYOUT.positions.get(cellKey("a", "a5"))).toStrictEqual({ row: 1, col: 1 });
		expect(LAYOUT.positions.get(cellKey("b", "b1"))).toStrictEqual({ row: 2, col: 0 });
	});

	it("finds the last item at or above an offset", (): void => {
		expect(indexAt(LAYOUT.rows, 0)).toBe(0);
		expect(indexAt(LAYOUT.rows, 60)).toBe(1);
		expect(indexAt(LAYOUT.rows, 1000)).toBe(2);
		expect(indexAt([], 10)).toBe(0);
	});
});

describe("moveActiveCell", () => {
	it("returns null on an empty grid", (): void => {
		expect(moveActiveCell(moveInput({ layout: buildLayout([], 3, SIZE) }))).toBeNull();
	});

	it("wraps next and prev across rows", (): void => {
		expect(moveActiveCell(moveInput({ at: { row: 0, col: 2 }, to: "next" }))).toMatchObject({ kind: "cell", position: { row: 1, col: 0 }, emojiId: "a4" });
		expect(moveActiveCell(moveInput({ at: { row: 1, col: 0 }, to: "prev" }))).toMatchObject({ position: { row: 0, col: 2 } });
		expect(moveActiveCell(moveInput({ at: { row: 2, col: 1 }, to: "next" }))).toMatchObject({ position: { row: 2, col: 1 }, sectionId: "b" });
	});

	it("keeps the goal column across a shorter row", (): void => {
		const down = moveActiveCell(moveInput({ at: { row: 0, col: 2 }, to: "down" }));
		expect(down).toMatchObject({ position: { row: 1, col: 1 }, goalColumn: 2 });
		expect(moveActiveCell(moveInput({ at: { row: 1, col: 1 }, to: "up", goalColumn: 2 }))).toMatchObject({ position: { row: 0, col: 2 } });
	});

	it("hands Up from the top row back to the search, unless searching", (): void => {
		expect(moveActiveCell(moveInput({ to: "up" }))).toStrictEqual({ kind: "release" });
		expect(moveActiveCell(moveInput({ to: "up", searching: true }))).toMatchObject({ kind: "cell", position: { row: 0, col: 0 } });
	});

	it("pages, jumps to the ends, and starts at the first visible row", (): void => {
		expect(moveActiveCell(moveInput({ to: "pageDown" }))).toMatchObject({ position: { row: 2, col: 0 } });
		expect(moveActiveCell(moveInput({ at: { row: 2, col: 0 }, to: "pageUp" }))).toMatchObject({ position: { row: 0, col: 0 } });
		expect(moveActiveCell(moveInput({ to: "last" }))).toMatchObject({ position: { row: 2, col: 1 }, emojiId: "b2" });
		expect(moveActiveCell(moveInput({ at: { row: 2, col: 1 }, to: "first" }))).toMatchObject({ position: { row: 0, col: 0 } });
		expect(moveActiveCell(moveInput({ at: undefined, to: "down", scrollTop: 60 }))).toMatchObject({ position: { row: 2, col: 0 } });
	});
});
