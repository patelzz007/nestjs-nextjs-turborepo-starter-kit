import type { ColumnDef, RowData } from "@tanstack/react-table";

import { DataTableCellScalarSchema, parseDataTableCellValue, readDataTableRowField, toDataTableCellString } from "./data-table-prefs";

/** Display string for a typed row field at export boundaries. */
function rowFieldDisplayString(row: object, key: string): string {
	return toDataTableCellString(parseDataTableCellValue(readDataTableRowField(row, key)));
}

/**
 * Escapes a cell value for CSV/Spreadsheet exports so spreadsheet apps do not
 * evaluate it as a formula.
 */
export function sanitizeExportCell(value: Parameters<typeof parseDataTableCellValue>[0]): string {
	const str = toDataTableCellString(parseDataTableCellValue(value));
	return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/** Builds export column list, excluding utility columns (select/drag/actions). */
export function buildExportColumns<TFeatures extends object, TData extends RowData>(
	columns: ColumnDef<TFeatures, TData>[],
	extra: readonly string[] = ["select", "actions", "drag"],
): ColumnDef<TFeatures, TData>[] {
	return columns.filter((col) => {
		const key = "id" in col ? String(col.id) : "accessorKey" in col ? String(col.accessorKey) : undefined;
		return key !== undefined && !extra.includes(key);
	});
}

export function exportToCSV<TFeatures extends object, TData extends RowData>(data: TData[], columns: ColumnDef<TFeatures, TData>[], filename = "export.csv"): void {
	if (data.length === 0) {
		return;
	}

	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) {
				return String(col.id);
			}
			if ("accessorKey" in col) {
				return String(col.accessorKey);
			}
			return undefined;
		})
		.filter((id): id is string => id !== undefined && id !== "select" && id !== "actions");

	const csvRows = [headers.join(",")];
	for (const row of data) {
		const values = headers.map((header) => {
			const str = sanitizeExportCell(readDataTableRowField(row, header));
			return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
		});
		csvRows.push(values.join(","));
	}

	const csv = csvRows.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function exportToJSON<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const jsonData = rows.map((row) => {
		const obj: Record<string, string | number | boolean | null> = {};
		for (const col of columns) {
			const key = "id" in col ? String(col.id) : "accessorKey" in col ? String(col.accessorKey) : undefined;
			if (key !== undefined) {
				const value = readDataTableRowField(row, key);
				const scalar = DataTableCellScalarSchema.safeParse(value);
				obj[key] = scalar.success ? scalar.data : toDataTableCellString(value);
			}
		}
		return obj;
	});
	const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Emits a SpreadsheetML 2003 document (`.xls`) Excel opens natively. */
export function exportToSpreadsheet<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) return String(col.id);
			if ("accessorKey" in col) return String(col.accessorKey);
			return undefined;
		})
		.filter((id): id is string => id !== undefined);

	const rowXml = (values: readonly string[]): string =>
		`<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(sanitizeExportCell(value))}</Data></Cell>`).join("")}</Row>`;

	const bodyXml = [rowXml(headers), ...rows.map((row) => rowXml(headers.map((header) => rowFieldDisplayString(row, header))))].join("");

	const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="Data">
<Table>${bodyXml}</Table>
</Worksheet>
</Workbook>`;

	const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.xls`;
	link.click();
	URL.revokeObjectURL(url);
}

/** Exports rows as a print-ready PDF via a hidden iframe print dialog. */
export function exportToPDF<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) return String(col.id);
			if ("accessorKey" in col) return String(col.accessorKey);
			return undefined;
		})
		.filter((id): id is string => id !== undefined);

	const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

	const headerRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
	const bodyRows = rows
		.map((row) => {
			const cells = headers.map((header) => `<td>${escapeHtml(rowFieldDisplayString(row, header))}</td>`).join("");
			return `<tr>${cells}</tr>`;
		})
		.join("");

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(filename)}</title>
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
<h1>${escapeHtml(filename)}</h1>
<table>
<thead>${headerRow}</thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;

	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.setAttribute("title", "Print preview");
	frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
	frame.srcdoc = html;

	const onFrameLoad = (): void => {
		const frameWindow = frame.contentWindow;
		if (frameWindow === null) {
			window.print();
			return;
		}
		frameWindow.focus();
		frameWindow.print();
	};

	frame.addEventListener("load", onFrameLoad);
	document.body.appendChild(frame);
}
