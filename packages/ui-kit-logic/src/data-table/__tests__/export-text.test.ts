import { describe, expect, it } from "vitest";

import { buildCsvText, buildJsonText, buildPrintHtml, buildSpreadsheetXml, exportColumnIds, sanitizeExportCell, sanitizeExportFilename } from "../export-text";

interface Invoice {
	readonly id: string;
	readonly customer: string;
	readonly amount: number;
	readonly paid: boolean;
}

const ROWS: readonly Invoice[] = [
	{ id: "INV-1", customer: "Acme, Inc.", amount: 120, paid: true },
	{ id: "INV-2", customer: "=SUM(A1)", amount: 80, paid: false },
];

const COLUMN_IDS: readonly string[] = ["id", "customer", "amount"];

/** The byte order mark a CSV starts with. */
const BOM = "﻿";

describe("sanitizeExportCell", () => {
	it("quotes cells a spreadsheet would run as a formula", () => {
		expect(sanitizeExportCell("=1+1")).toBe("'=1+1");
		expect(sanitizeExportCell("+44")).toBe("'+44");
		expect(sanitizeExportCell("-3")).toBe("'-3");
		expect(sanitizeExportCell("@user")).toBe("'@user");
	});

	it("keeps ordinary values, and writes empty cells as nothing", () => {
		expect(sanitizeExportCell("Acme")).toBe("Acme");
		expect(sanitizeExportCell(42)).toBe("42");
		expect(sanitizeExportCell(null)).toBe("");
		expect(sanitizeExportCell(undefined)).toBe("");
	});
});

describe("sanitizeExportFilename", () => {
	it("replaces path separators, parent references and reserved characters", () => {
		expect(sanitizeExportFilename("../invoices/2025:Q1?.csv")).toBe("__invoices_2025_Q1_.csv");
	});

	it("falls back to export when nothing is left", () => {
		expect(sanitizeExportFilename("")).toBe("export");
	});
});

describe("exportColumnIds", () => {
	it("keeps each column's id or accessorKey, less the table's own columns and columns without an id", () => {
		const columns: readonly object[] = [{ id: "select" }, { accessorKey: "id" }, { id: "customer" }, { header: "No id" }, { id: "actions" }, { id: "drag" }];
		expect(exportColumnIds(columns)).toEqual(["id", "customer"]);
	});

	it("leaves out the ids it is told to", () => {
		expect(exportColumnIds([{ id: "id" }, { id: "customer" }], ["customer"])).toEqual(["id"]);
	});
});

describe("buildCsvText", () => {
	it("writes a header, one line per row, quoting commas and neutralising formulas", () => {
		expect(buildCsvText(ROWS, COLUMN_IDS)).toBe(`${BOM}id,customer,amount\r\nINV-1,"Acme, Inc.",120\r\nINV-2,'=SUM(A1),80`);
	});

	it("doubles quotes inside a quoted field", () => {
		expect(buildCsvText([{ note: 'He said "hi"' }], ["note"])).toBe(`${BOM}note\r\n"He said ""hi"""`);
	});
});

describe("buildJsonText", () => {
	it("keeps scalars as they are, one key per column", () => {
		expect(JSON.parse(buildJsonText(ROWS, ["id", "amount", "paid"]))).toEqual([
			{ id: "INV-1", amount: 120, paid: true },
			{ id: "INV-2", amount: 80, paid: false },
		]);
	});

	it("writes a missing field as an empty string", () => {
		expect(JSON.parse(buildJsonText([{ id: "A" }], ["id", "missing"]))).toEqual([{ id: "A", missing: "" }]);
	});
});

describe("buildSpreadsheetXml", () => {
	it("writes a header row and escaped, sanitised cells", () => {
		const xml = buildSpreadsheetXml([{ name: "<b>&co" }, { name: "=1" }], ["name"]);
		expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
		expect(xml).toContain('<Row><Cell><Data ss:Type="String">name</Data></Cell></Row>');
		expect(xml).toContain("&lt;b&gt;&amp;co");
		expect(xml).toContain("&apos;=1");
	});
});

describe("buildPrintHtml", () => {
	it("titles the document and escapes every cell", () => {
		const html = buildPrintHtml([{ name: '<script>"x"' }], ["name"], "Q1 <invoices>");
		expect(html).toContain("<title>Q1 &lt;invoices&gt;</title>");
		expect(html).toContain("<h1>Q1 &lt;invoices&gt;</h1>");
		expect(html).toContain("<th>name</th>");
		expect(html).toContain("<td>&lt;script&gt;&quot;x&quot;</td>");
	});
});
