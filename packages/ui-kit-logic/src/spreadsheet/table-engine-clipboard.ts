// The data grid's clipboard text, shared by the web and native kits: TSV with Excel-style quoting (what Excel and
// Sheets copy and paste), its parser, tiling a copied block over a larger selection, and a minimal HTML table flavour.
// Pure string work: reading and writing the clipboard is each platform's own.

import { LIST_SLOT_INDEX } from "@workspace/shared";

export const TABLE_ENGINE_CLIPBOARD_QUOTE_NEEDED = /[\t\n\r"]/;
export const TABLE_ENGINE_CLIPBOARD_LINE_BREAK = /\r\n|\r|\n/g;

export function serializeTableEngineClipboardField(field: string): string {
	// Excel and Sheets quote a field containing a delimiter and double inner
	// quotes; everything else ships bare.
	return TABLE_ENGINE_CLIPBOARD_QUOTE_NEEDED.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/** Row-major grid → TSV, CRLF rows, Excel-style quoting. */
export function serializeTableEngineClipboardText(grid: readonly (readonly string[])[]): string {
	return grid.map((line) => line.map(serializeTableEngineClipboardField).join("\t")).join("\r\n");
}

/**
 * TSV → a row-major grid. A stateful scan, not a split: a quoted field may
 * contain tabs, quotes and both newline flavours, which is exactly what Excel
 * emits for a multi-line cell.
 */
export function parseTableEngineClipboardText(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	let index = 0;

	while (index < text.length) {
		const char = text.charAt(index);
		if (quoted) {
			if (char === '"') {
				if (text.charAt(index + 1) === '"') {
					field += '"';
					index += 2;
					continue;
				}
				quoted = false;
				index += 1;
				continue;
			}
			field += char;
			index += 1;
			continue;
		}
		if (char === '"' && field === "") {
			quoted = true;
			index += 1;
			continue;
		}
		if (char === "\t") {
			row.push(field);
			field = "";
			index += 1;
			continue;
		}
		if (char === "\r" || char === "\n") {
			if (char === "\r" && text.charAt(index + 1) === "\n") {
				index += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			index += 1;
			continue;
		}
		field += char;
		index += 1;
	}
	row.push(field);
	rows.push(row);

	// Excel terminates the payload with one newline; that final empty line is
	// an artifact of the format, not a data row.
	const last = rows.at(-1);
	if (rows.length > 1 && last?.length === 1 && last.at(LIST_SLOT_INDEX.first) === "") {
		rows.pop();
	}

	return rows;
}

/** Repeats a block cyclically to fill `rowCount` × `columnCount`. */
export function tileTableEngineClipboardBlock(block: readonly (readonly string[])[], rowCount: number, columnCount: number): string[][] {
	const tiled: string[][] = [];
	for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
		const source = block.at(rowOffset % Math.max(block.length, 1)) ?? [];
		const line: string[] = [];
		for (let columnOffset = 0; columnOffset < columnCount; columnOffset++) {
			line.push(source.at(columnOffset % Math.max(source.length, 1)) ?? "");
		}
		tiled.push(line);
	}
	return tiled;
}

export function escapeTableEngineClipboardHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A minimal text/html flavour alongside the TSV keeps type fidelity when the
 * paste target is Excel or Sheets. Newlines inside a field become `<br>`.
 */
export function renderTableEngineClipboardHtml(grid: readonly (readonly string[])[]): string {
	const body = grid
		.map((line) => `<tr>${line.map((field) => `<td>${escapeTableEngineClipboardHtml(field).replace(TABLE_ENGINE_CLIPBOARD_LINE_BREAK, "<br>")}</td>`).join("")}</tr>`)
		.join("");
	return `<table><tbody>${body}</tbody></table>`;
}
