import { DEFAULT_DATA_TABLE_LABELS, dataTableExportFileOf, dataTablePageRangeOf, nextDataTableSort, parseEditedDataTableCell } from "../data-table";

const ROWS: readonly object[] = [
	{ id: "INV-1", amount: 120 },
	{ id: "INV-2", amount: 80 },
];
const IDS: readonly string[] = ["id", "amount"];

describe("nextDataTableSort", () => {
	it("goes ascending, then descending, then back to ascending", () => {
		expect(nextDataTableSort(false, "asc-desc")).toBe("asc");
		expect(nextDataTableSort("asc", "asc-desc")).toBe("desc");
		expect(nextDataTableSort("desc", "asc-desc")).toBe("asc");
	});

	it("returns to the original order on the third press with asc-desc-none", () => {
		expect(nextDataTableSort("asc", "asc-desc-none")).toBe("desc");
		expect(nextDataTableSort("desc", "asc-desc-none")).toBe(false);
	});
});

describe("parseEditedDataTableCell", () => {
	it("keeps a number a number when the text is one", () => {
		expect(parseEditedDataTableCell(12, " 42 ")).toBe(42);
		expect(parseEditedDataTableCell(12, "-3.5")).toBe(-3.5);
	});

	it("keeps the text when a number's replacement is not one", () => {
		expect(parseEditedDataTableCell(12, "twelve")).toBe("twelve");
	});

	it("keeps a boolean a boolean for true and false", () => {
		expect(parseEditedDataTableCell(false, "true")).toBe(true);
		expect(parseEditedDataTableCell(true, "false")).toBe(false);
		expect(parseEditedDataTableCell(true, "maybe")).toBe("maybe");
	});

	it("keeps text as text, even when it reads as a number", () => {
		expect(parseEditedDataTableCell("18", "19")).toBe("19");
		expect(parseEditedDataTableCell(null, "x")).toBe("x");
	});
});

describe("dataTablePageRangeOf", () => {
	it("is the one-based range a page shows", () => {
		expect(dataTablePageRangeOf(0, 10, 25)).toEqual({ from: 1, to: 10 });
		expect(dataTablePageRangeOf(2, 10, 25)).toEqual({ from: 21, to: 25 });
	});

	it("is empty with no rows", () => {
		expect(dataTablePageRangeOf(0, 10, 0)).toEqual({ from: 0, to: 0 });
	});
});

describe("dataTableExportFileOf", () => {
	it("names the file by the format and builds its text", () => {
		const csv = dataTableExportFileOf("csv", ROWS, IDS, "invoices");
		expect(csv).toEqual(expect.objectContaining({ format: "csv", filename: "invoices.csv", mimeType: "text/csv" }));
		expect(csv.text).toContain("id,amount\r\nINV-1,120\r\nINV-2,80");
	});

	it("writes JSON, a spreadsheet, and a print document for PDF", () => {
		expect(JSON.parse(dataTableExportFileOf("json", ROWS, IDS, "invoices").text)).toEqual(ROWS);
		const sheet = dataTableExportFileOf("xlsx", ROWS, IDS, "invoices");
		expect(sheet.filename).toBe("invoices.xls");
		expect(sheet.text).toContain("<Workbook");
		const print = dataTableExportFileOf("pdf", ROWS, IDS, "invoices");
		expect(print).toEqual(expect.objectContaining({ filename: "invoices.html", mimeType: "text/html" }));
		expect(print.text).toContain("<h1>invoices</h1>");
	});

	it("makes the name safe for a file system", () => {
		expect(dataTableExportFileOf("csv", ROWS, IDS, "../q1:invoices").filename).toBe("__q1_invoices.csv");
	});
});

describe("DEFAULT_DATA_TABLE_LABELS", () => {
	it("keeps the placeholders the table fills in", () => {
		expect(DEFAULT_DATA_TABLE_LABELS.showingResults).toBe("Showing {from} to {to} of {total} results");
		expect(DEFAULT_DATA_TABLE_LABELS.editCell).toContain("{column}");
		expect(DEFAULT_DATA_TABLE_LABELS.selectNamedRow).toContain("{row}");
		expect(DEFAULT_DATA_TABLE_LABELS.pageSizeOption).toContain("{count}");
		expect(DEFAULT_DATA_TABLE_LABELS.pinNamedColumn).toContain("{column}");
	});
});
