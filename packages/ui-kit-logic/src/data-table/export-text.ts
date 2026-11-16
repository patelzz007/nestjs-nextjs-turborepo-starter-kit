// DataTable export, as text, shared by the web and native kits: which columns go out, and the CSV, JSON,
// spreadsheet and print documents built from the rows. Each kit hands the text on its own way (the web downloads
// a file; native shares it). Cells are sanitised against spreadsheet formula injection.

import { DATA_TABLE_UTILITY_COLUMN_IDS, resolveDataTableColumnId } from "./column-ids";
import { DataTableCellScalarSchema, parseDataTableCellValue, readDataTableRowField, toDataTableCellString, type DataTableCellInput } from "./prefs";

/** A cell starting with one of these could run as a spreadsheet formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Characters that make a CSV field need quotes. */
const CSV_SPECIAL = /[",\n\r]/;

/** Spaces per level of JSON indentation. */
const JSON_INDENT = 2;

/** The byte order mark that tells spreadsheet apps a CSV is UTF-8. */
const UTF8_BOM = "﻿";

/** A row field as display text. */
function rowFieldDisplayString(row: object, key: string): string {
	return toDataTableCellString(parseDataTableCellValue(readDataTableRowField(row, key)));
}

/** Escapes a cell so spreadsheet apps do not evaluate it as a formula. */
export function sanitizeExportCell(value: DataTableCellInput): string {
	const text = toDataTableCellString(parseDataTableCellValue(value));
	return FORMULA_START.test(text) ? `'${text}` : text;
}

function escapeCsvField(value: string): string {
	const sanitized = sanitizeExportCell(value);
	return CSV_SPECIAL.test(sanitized) ? `"${sanitized.replaceAll('"', '""')}"` : sanitized;
}

/** A filename without path separators, `..` or characters file systems reject; "export" when nothing is left. */
export function sanitizeExportFilename(filename: string): string {
	const base = filename.replace(/[/\\?%*:|"<>]/g, "_").replaceAll("..", "_");
	return base.length > 0 ? base : "export";
}

/** The ids of the columns that go out: every column with an id, less the table's own (select, drag, actions). */
export function exportColumnIds(columns: readonly object[], excluded: readonly string[] = DATA_TABLE_UTILITY_COLUMN_IDS): string[] {
	return columns
		.map((column: object): string | undefined => resolveDataTableColumnId(column))
		.filter((id: string | undefined): id is string => id !== undefined && !excluded.includes(id));
}

/** The rows as CSV: a header row of column ids, then one line per row, with a UTF-8 byte order mark. */
export function buildCsvText(rows: readonly object[], columnIds: readonly string[]): string {
	const lines = [columnIds.map(escapeCsvField).join(",")];
	for (const row of rows) {
		lines.push(columnIds.map((id: string): string => escapeCsvField(rowFieldDisplayString(row, id))).join(","));
	}
	return `${UTF8_BOM}${lines.join("\r\n")}`;
}

/** The rows as a JSON array of objects, one key per column, scalars kept as they are. */
export function buildJsonText(rows: readonly object[], columnIds: readonly string[]): string {
	const records = rows.map((row: object): Record<string, string | number | boolean | null> => {
		const record: Record<string, string | number | boolean | null> = {};
		for (const id of columnIds) {
			const value = readDataTableRowField(row, id);
			const scalar = DataTableCellScalarSchema.safeParse(value);
			record[id] = scalar.success ? scalar.data : toDataTableCellString(value);
		}
		return record;
	});
	return JSON.stringify(records, null, JSON_INDENT);
}

function escapeXml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

/** The rows as a SpreadsheetML 2003 document (`.xls`), which Excel opens natively. */
export function buildSpreadsheetXml(rows: readonly object[], columnIds: readonly string[]): string {
	const rowXml = (values: readonly string[]): string =>
		`<Row>${values.map((value: string): string => `<Cell><Data ss:Type="String">${escapeXml(sanitizeExportCell(value))}</Data></Cell>`).join("")}</Row>`;
	const bodyXml = [rowXml(columnIds), ...rows.map((row: object): string => rowXml(columnIds.map((id: string): string => rowFieldDisplayString(row, id))))].join("");
	return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="Data">
<Table>${bodyXml}</Table>
</Worksheet>
</Workbook>`;
}

function escapeHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** The rows as a print-ready HTML document titled `title`. */
export function buildPrintHtml(rows: readonly object[], columnIds: readonly string[], title: string): string {
	const headerRow = `<tr>${columnIds.map((id: string): string => `<th>${escapeHtml(sanitizeExportCell(id))}</th>`).join("")}</tr>`;
	const bodyRows = rows
		.map((row: object): string => `<tr>${columnIds.map((id: string): string => `<td>${escapeHtml(rowFieldDisplayString(row, id))}</td>`).join("")}</tr>`)
		.join("");
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
	* { box-sizing: border-box; }
	body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: var(--print-foreground, oklch(0.21 0.034 264.665)); }
	h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem; }
	table { border-collapse: collapse; width: 100%; font-size: 0.8125rem; }
	th { background: var(--print-header-bg, oklch(0.967 0.003 264.542)); font-weight: 600; text-align: left; }
	th, td { border: 1px solid var(--print-border, oklch(0.928 0.006 264.531)); padding: 0.5rem 0.75rem; }
	tr:nth-child(even) td { background: var(--print-row-alt, oklch(0.985 0.002 247.839)); }
	@media print { body { margin: 0.5in; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<table>
<thead>${headerRow}</thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}
