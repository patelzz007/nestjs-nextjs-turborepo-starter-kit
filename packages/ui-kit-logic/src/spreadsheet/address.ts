// A1 addressing, shared by the web and native spreadsheets: column letters (A, Z, AA), cell references (B2) and
// ranges (A1:C4). Zero-based indexes inside, letters and one-based row numbers outside. Pure.

/** A cell by its zero-based column and row index. */
export interface SpreadsheetCellRef {
	readonly column: number;
	readonly row: number;
}

/** A rectangle of cells, both corners included, normalised so `start` is the top-left one. */
export interface SpreadsheetRangeRef {
	readonly start: SpreadsheetCellRef;
	readonly end: SpreadsheetCellRef;
}

const LETTER_COUNT = 26;
const LETTER_A_CODE = "A".charCodeAt(0);
const ONE_BASED = 1;
const CELL_REF = /^(?<letters>[A-Za-z]+)(?<digits>[1-9]\d*)$/u;
const COLUMN_LETTERS = /^[A-Za-z]+$/u;

/** `0` → `A`, `25` → `Z`, `26` → `AA`. */
export function spreadsheetColumnLetters(columnIndex: number): string {
	let letters = "";
	let remaining = columnIndex + ONE_BASED;
	while (remaining > 0) {
		const offset = (remaining - ONE_BASED) % LETTER_COUNT;
		letters = String.fromCharCode(LETTER_A_CODE + offset) + letters;
		remaining = Math.floor((remaining - ONE_BASED) / LETTER_COUNT);
	}
	return letters;
}

/** `A` → `0`, `AA` → `26`, lower case too; `null` for text that is not column letters. */
export function spreadsheetColumnIndex(letters: string): number | null {
	if (!COLUMN_LETTERS.test(letters)) {
		return null;
	}
	let index = 0;
	for (const letter of letters.toUpperCase()) {
		index = index * LETTER_COUNT + (letter.charCodeAt(0) - LETTER_A_CODE + ONE_BASED);
	}
	return index - ONE_BASED;
}

/** `B2` → column 1, row 1; `null` for text that is not a cell reference. */
export function parseSpreadsheetCellRef(text: string): SpreadsheetCellRef | null {
	const groups = CELL_REF.exec(text.trim())?.groups;
	if (groups === undefined) {
		return null;
	}
	const column = spreadsheetColumnIndex(groups.letters ?? "");
	return column === null ? null : { column, row: Number(groups.digits) - ONE_BASED };
}

/** Column 1, row 1 → `B2`. */
export function formatSpreadsheetCellRef(ref: SpreadsheetCellRef): string {
	return `${spreadsheetColumnLetters(ref.column)}${String(ref.row + ONE_BASED)}`;
}

/** `A1:C4` (either corner first) → the normalised range; a single cell `B2` is a one-cell range; `null` otherwise. */
export function parseSpreadsheetRangeRef(text: string): SpreadsheetRangeRef | null {
	const [first, second, ...rest] = text.split(":");
	if (first === undefined || rest.length > 0) {
		return null;
	}
	const a = parseSpreadsheetCellRef(first);
	const b = second === undefined ? a : parseSpreadsheetCellRef(second);
	if (a === null || b === null) {
		return null;
	}
	return {
		start: { column: Math.min(a.column, b.column), row: Math.min(a.row, b.row) },
		end: { column: Math.max(a.column, b.column), row: Math.max(a.row, b.row) },
	};
}

/** Every cell of a range, row by row, left to right. */
export function spreadsheetRangeCells(range: SpreadsheetRangeRef): SpreadsheetCellRef[] {
	const cells: SpreadsheetCellRef[] = [];
	for (let row = range.start.row; row <= range.end.row; row += 1) {
		for (let column = range.start.column; column <= range.end.column; column += 1) {
			cells.push({ column, row });
		}
	}
	return cells;
}

/** A cell moved by whole rows and columns, as a filled or pasted formula's relative reference moves; `null` off the sheet. */
export function offsetSpreadsheetCellRef(ref: SpreadsheetCellRef, rows: number, columns: number): SpreadsheetCellRef | null {
	const moved = { column: ref.column + columns, row: ref.row + rows };
	return moved.column < 0 || moved.row < 0 ? null : moved;
}
