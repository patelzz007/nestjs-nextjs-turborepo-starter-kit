import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildExportColumns, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet } from "../export";

interface Invoice {
	readonly id: string;
	readonly total: number;
}

/** The table features the columns are typed for: none beyond the core. */
type Features = object;

const COLUMNS: ColumnDef<Features, Invoice>[] = [{ id: "select" }, { accessorKey: "id" }, { accessorKey: "total" }, { id: "actions" }];
const ROWS: Invoice[] = [{ id: "INV-1", total: 30 }];

/** What a download hands the browser: the file's name and its type. */
interface Download {
	readonly filename: string;
	readonly type: string;
}

const downloads: Download[] = [];

beforeEach((): void => {
	vi.useFakeTimers();
	downloads.length = 0;
	vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource): string => (blob instanceof Blob ? `blob:${blob.type}` : "blob:"));
	vi.spyOn(URL, "revokeObjectURL").mockImplementation((): void => undefined);
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record(this: HTMLAnchorElement): void {
		downloads.push({ filename: this.download, type: this.href.replace("blob:", "") });
	});
});

afterEach((): void => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

describe("the web's data table export", () => {
	it("leaves the utility columns out", () => {
		expect(buildExportColumns(COLUMNS).map((column) => ("accessorKey" in column ? column.accessorKey : column.id))).toStrictEqual(["id", "total"]);
		expect(buildExportColumns(COLUMNS, ["id"])).toHaveLength(3);
	});

	it("downloads CSV, JSON and spreadsheet files by name, releasing each link after the click", () => {
		const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation((): void => undefined);
		exportToCSV(ROWS, COLUMNS, "invoices.csv");
		exportToJSON(ROWS, COLUMNS, "invoices.json");
		exportToJSON(ROWS, COLUMNS, "ledger");
		exportToSpreadsheet(ROWS, COLUMNS, "invoices");
		expect(downloads).toStrictEqual([
			{ filename: "invoices.csv", type: "text/csv;charset=utf-8;" },
			{ filename: "invoices.json", type: "application/json" },
			{ filename: "ledger.json", type: "application/json" },
			{ filename: "invoices.xls", type: "application/vnd.ms-excel" },
		]);
		expect(document.querySelectorAll("a")).toHaveLength(0);
		vi.runAllTimers();
		expect(revoke).toHaveBeenCalledTimes(downloads.length);
	});

	it("downloads nothing for no rows", () => {
		exportToCSV([], COLUMNS);
		expect(downloads).toHaveLength(0);
	});

	it("prints through a hidden frame, removed after printing", () => {
		// The frame's window is the test's own: its print dialog is the one recorded.
		vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(window);
		const print = vi.spyOn(window, "print").mockImplementation((): void => undefined);
		exportToPDF(ROWS, COLUMNS, "invoices");
		const frame = document.querySelector("iframe");
		expect(frame?.getAttribute("aria-hidden")).toBe("true");
		frame?.dispatchEvent(new Event("load"));
		expect(print).toHaveBeenCalledTimes(1);
		vi.runAllTimers();
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("prints the page itself when the frame has no window", () => {
		vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(null);
		const printPage = vi.spyOn(window, "print").mockImplementation((): void => undefined);
		exportToPDF(ROWS, COLUMNS, "invoices");
		document.querySelector("iframe")?.dispatchEvent(new Event("load"));
		expect(printPage).toHaveBeenCalledTimes(1);
		expect(document.querySelector("iframe")).toBeNull();
	});
});
