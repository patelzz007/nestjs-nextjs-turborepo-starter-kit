// DataTable export on the web: the documents are built by the shared builders (@workspace/shared, also used by the
// native kit) and downloaded here as files, or printed (PDF).

import type { ColumnDef, RowData } from "@tanstack/react-table";
import {
	buildCsvText,
	buildJsonText,
	buildPrintHtml,
	buildSpreadsheetXml,
	DATA_TABLE_UTILITY_COLUMN_IDS,
	exportColumnIds,
	resolveDataTableColumnId,
	sanitizeExportFilename,
} from "@workspace/ui-kit-logic";

export { sanitizeExportCell } from "@workspace/ui-kit-logic";

/** How long a download's object URL (and the print frame) outlive the click, so the browser can use them. */
const RELEASE_DELAY_MS = 1000;

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = sanitizeExportFilename(filename);
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.setTimeout((): void => {
		URL.revokeObjectURL(url);
	}, RELEASE_DELAY_MS);
}

/** Builds export column list, excluding utility columns (select/drag/actions). */
export function buildExportColumns<TFeatures extends object, TData extends RowData>(
	columns: ColumnDef<TFeatures, TData>[],
	extra: readonly string[] = DATA_TABLE_UTILITY_COLUMN_IDS,
): ColumnDef<TFeatures, TData>[] {
	return columns.filter((col) => {
		const key = resolveDataTableColumnId(col);
		return key !== undefined && !extra.includes(key);
	});
}

/** Downloads rows as a CSV file, cells sanitised against spreadsheet formula injection. */
export function exportToCSV<TFeatures extends object, TData extends RowData>(data: TData[], columns: ColumnDef<TFeatures, TData>[], filename = "export.csv"): void {
	if (data.length === 0) {
		return;
	}
	const csv = buildCsvText(data, exportColumnIds(columns));
	downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/** Downloads rows as a JSON file. */
export function exportToJSON<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const baseName = filename.endsWith(".json") ? filename.slice(0, -".json".length) : filename;
	const json = buildJsonText(rows, exportColumnIds(columns));
	downloadBlob(new Blob([json], { type: "application/json" }), `${baseName}.json`);
}

/** Downloads a SpreadsheetML 2003 document (`.xls`) Excel opens natively. */
export function exportToSpreadsheet<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const xml = buildSpreadsheetXml(rows, exportColumnIds(columns));
	downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel" }), `${filename}.xls`);
}

/** Exports rows as a print-ready PDF via a hidden iframe print dialog. */
export function exportToPDF<TFeatures extends object, TData extends RowData>(rows: TData[], columns: ColumnDef<TFeatures, TData>[], filename: string): void {
	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.setAttribute("title", "Print preview");
	frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
	frame.srcdoc = buildPrintHtml(rows, exportColumnIds(columns), filename);

	const onFrameLoad = (): void => {
		frame.removeEventListener("load", onFrameLoad);
		const frameWindow = frame.contentWindow;
		if (frameWindow === null) {
			frame.remove();
			window.print();
			return;
		}
		frameWindow.focus();
		frameWindow.print();
		window.setTimeout((): void => {
			frame.remove();
		}, RELEASE_DELAY_MS);
	};

	frame.addEventListener("load", onFrameLoad);
	document.body.appendChild(frame);
}
