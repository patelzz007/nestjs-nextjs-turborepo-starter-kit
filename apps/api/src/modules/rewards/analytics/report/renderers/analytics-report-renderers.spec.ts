import { ANALYTICS_EXPORT_CONTENT_TYPES, AnalyticsExportFormatSchema, type AnalyticsExportFormat } from "@workspace/shared";
import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { create } from "fontkit";
import { z } from "zod";

import { buildFixtureReport } from "../../../../../../test/support/analytics-report-fixture";
import { pdfTextRuns, readAll, xlsxParts } from "../../../../../../test/support/report-files";
import { testReportFontRegistry } from "../../../../../../test/support/report-fonts";
import { REPORT_FONT_FAMILIES } from "../fonts/report-fonts";
import { AnalyticsRendererMismatchError, AnalyticsReportRendererRegistry } from "./analytics-report-renderer.registry";
import { CSV_UTF8_BOM, CsvAnalyticsReportRenderer, csvRecord, escapeCsvField, protectFromFormula } from "./csv-analytics-report.renderer";
import { PdfAnalyticsReportRenderer } from "./pdf-analytics-report.renderer";
import { XLSX_SUMMARY_SHEET_NAME, XlsxAnalyticsReportRenderer } from "./xlsx-analytics-report.renderer";

const CRLF = "\r\n";
/** Upper bound for a one-page report using all four font families (the full fonts weigh ~22 MB). */
const MAX_SUBSET_PDF_BYTES = 200_000;

describe("CSV renderer", () => {
	const renderer = new CsvAnalyticsReportRenderer();

	async function render(): Promise<string> {
		return (await readAll(renderer.render(buildFixtureReport()))).toString("utf8");
	}

	it("escapes per RFC 4180: quotes a field with a comma, a quote, CR or LF and doubles its quotes", () => {
		expect(escapeCsvField("plain")).toBe("plain");
		expect(escapeCsvField("a,b")).toBe('"a,b"');
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvField("two\nlines")).toBe('"two\nlines"');
		expect(escapeCsvField("carriage\rreturn")).toBe('"carriage\rreturn"');
		expect(csvRecord(["a", "b,c"])).toBe(`a,"b,c"${CRLF}`);
	});

	it("neutralises every spreadsheet formula trigger at the start of a text cell (= + - @ TAB CR)", () => {
		for (const hostile of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"]) {
			expect(protectFromFormula(hostile)).toBe(`'${hostile}`);
		}
		expect(protectFromFormula("Free coffee")).toBe("Free coffee");
		expect(protectFromFormula("a=b")).toBe("a=b");
	});

	it("starts with a UTF-8 BOM and ends every record with CRLF", async () => {
		const csv = await render();

		expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
		expect(csv.endsWith(CRLF)).toBe(true);
		expect(csv.replaceAll(CRLF, "").includes("\r")).toBe(false);
	});

	it("writes the metadata, the KPI summary and every table with unit-named headers and locale-free values", async () => {
		const csv = await render();

		expect(csv).toContain(`Subject,"Brew & Bean, ""KL"""${CRLF}`);
		expect(csv).toContain(`Range,2026-09-07 to 2026-09-20 (Asia/Kuala_Lumpur)${CRLF}`);
		expect(csv).toContain(`Sales (MYR),1234.50,1000.00,234.50,23.5${CRLF}`);
		expect(csv).toContain(`Bills,42,0,42,${CRLF}`);
		expect(csv).toContain(`Conversion rate (%),62.5,70.0,-7.5,-10.7${CRLF}`);
		expect(csv).toContain(`Period start,Partial period,Sales (MYR),Bills,Conversion (%),Reward${CRLF}`);
		expect(csv).toContain(`2026-09-07,no,800.00,30,12.5,"'=HYPERLINK(""http://evil.example"",""click"")"${CRLF}`);
		expect(csv).toContain(`2026-09-14,yes,434.50,12,0.0,"Café, ""latte""\nsecond line"${CRLF}`);
		expect(csv).toContain(`Sales by store${CRLF}Store${CRLF}`);
	});
});

const SheetDataSchema = z.array(z.object({ sheet: z.string(), data: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.date(), z.null()]))) }));

describe("XLSX renderer", () => {
	const renderer = new XlsxAnalyticsReportRenderer();

	async function render(): Promise<Buffer> {
		return readAll(renderer.render(buildFixtureReport()));
	}

	it("writes a Summary sheet then one sheet per table", async () => {
		const sheets = SheetDataSchema.parse(await readXlsxFile(await render()));

		expect(sheets.map((sheet) => sheet.sheet)).toEqual([XLSX_SUMMARY_SHEET_NAME, "Activity over time", "Sales by store"]);
	});

	it("parses back with typed cells: money in major units, percentages as fractions, real dates, booleans, text never a formula", async () => {
		const sheets = SheetDataSchema.parse(await readXlsxFile(await render()));
		const summary = sheets.at(0)?.data ?? [];
		const series = sheets.at(1)?.data ?? [];

		expect(summary.at(0)).toEqual(["Metric", "Value", "Previous period", "Change", "Change %"]);
		expect(summary.at(1)).toEqual(["Sales (MYR)", 1234.5, 1000, 234.5, 0.235]);
		expect(summary.at(2)).toEqual(["Bills", 42, 0, 42, null]);
		expect(series.at(0)).toEqual(["Period start", "Partial period", "Sales (MYR)", "Bills", "Conversion", "Reward"]);
		expect(series.at(1)).toEqual([new Date(Date.UTC(2026, 8, 7)), false, 800, 30, 0.125, '=HYPERLINK("http://evil.example","click")']);
	});

	it("freezes the header row of every sheet and stores text as shared strings (no formula cells)", async () => {
		const parts = xlsxParts(await render());
		const sheetXml = [...parts.entries()].filter(([path]) => path.startsWith("xl/worksheets/sheet")).map(([, xml]) => xml);

		expect(sheetXml).toHaveLength(3);
		for (const xml of sheetXml) {
			expect(xml).toMatch(/<pane[^>]*ySplit="1"[^>]*state="frozen"/);
			expect(xml).not.toContain("<f>");
		}
	});
});

describe("PDF renderer", () => {
	const renderer = new PdfAnalyticsReportRenderer(testReportFontRegistry());

	it("is a valid PDF whose text holds the title, subject, range, KPIs, table titles and page numbers", async () => {
		const pdf = await readAll(renderer.render(buildFixtureReport()));
		const text = pdfTextRuns(pdf).join("\n");

		expect(pdf.subarray(0, "%PDF-".length).toString("latin1")).toBe("%PDF-");
		expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
		expect(text).toContain("Analytics report");
		expect(text).toContain('Brew & Bean, "KL"');
		expect(text).toContain("2026-09-07 to 2026-09-20 (Asia/Kuala_Lumpur)");
		expect(text).toContain("1,234.50");
		expect(text).toContain("+23.5% vs previous period");
		expect(text).toContain("Activity over time");
		expect(text).toContain("No data in this range");
		expect(text).toMatch(/Page 1 of \d+/);
	});
});

/** The five report languages: English, Malay, Tamil, Simplified Chinese, Hindi. */
const MULTILINGUAL = {
	english: "Free coffee with any breakfast",
	malay: "Kopi percuma bersama sarapan",
	tamil: "தமிழ் காலை உணவு",
	chinese: "中文报告 早餐咖啡",
	hindi: "हिन्दी नाश्ता क्षत्रिय",
};

function multilingualReport(): ReturnType<typeof buildFixtureReport> {
	return buildFixtureReport({
		subjectName: `${MULTILINGUAL.chinese} · ${MULTILINGUAL.tamil}`,
		tables: [
			{
				key: "rewards",
				title: "Rewards",
				columns: [
					{ header: "Reward", kind: "text" },
					{ header: "Claims", kind: "count" },
				],
				rows: Object.values(MULTILINGUAL).map((title, index) => [
					{ kind: "text", value: title },
					{ kind: "count", value: index + 1 },
				]),
			},
		],
	});
}

/** A text the way a shaped run reads back from a PDF: glyph by glyph, in visual order. */
function glyphOrder(familyKey: string, text: string): string {
	const family = REPORT_FONT_FAMILIES.find((candidate) => candidate.key === familyKey);
	const font = create(readFileSync(family?.files.regular.url ?? ""));
	if ("fonts" in font) throw new Error("expected a single font");
	return font
		.layout(text)
		.glyphs.map((glyph) => String.fromCodePoint(...glyph.codePoints))
		.join("");
}

describe("every renderer, in all five report languages", () => {
	it("CSV keeps English, Malay, Tamil, Chinese and Hindi intact (UTF-8)", async () => {
		const csv = (await readAll(new CsvAnalyticsReportRenderer().render(multilingualReport()))).toString("utf8");

		for (const [index, title] of Object.values(MULTILINGUAL).entries()) {
			expect(csv).toContain(`${title},${String(index + 1)}\r\n`);
		}
	});

	it("XLSX keeps them intact as text cells", async () => {
		const sheets = SheetDataSchema.parse(await readXlsxFile(await readAll(new XlsxAnalyticsReportRenderer().render(multilingualReport()))));

		expect(
			sheets
				.at(1)
				?.data.slice(1)
				.map((row) => row[0]),
		).toEqual(Object.values(MULTILINGUAL));
	});

	it("PDF draws each script in its own font — the text reads back, shaped, with no replacement characters", async () => {
		const pdf = await readAll(new PdfAnalyticsReportRenderer(testReportFontRegistry()).render(multilingualReport()));
		const runs = pdfTextRuns(pdf);
		const text = runs.join("\n");

		expect(text).toContain(MULTILINGUAL.english);
		expect(text).toContain(MULTILINGUAL.malay);
		expect(text).toContain("中文报告 早餐咖啡");
		// Tamil and Devanagari read back in glyph (visual) order — exactly the shaped runs fontkit produced.
		expect(text).toContain(glyphOrder("tamil", MULTILINGUAL.tamil));
		expect(text).toContain(glyphOrder("devanagari", MULTILINGUAL.hindi));
		expect(glyphOrder("devanagari", "हिन्दी")).toBe("िहन्दी");
		expect(text).not.toContain("?");
		expect(text).not.toContain("\uFFFD");
	});

	it("keeps the PDF small: fonts are embedded as subsets", async () => {
		const pdf = await readAll(new PdfAnalyticsReportRenderer(testReportFontRegistry()).render(multilingualReport()));

		expect(pdf.length).toBeLessThan(MAX_SUBSET_PDF_BYTES);
	});
});

describe("AnalyticsReportRendererRegistry", () => {
	const csv = new CsvAnalyticsReportRenderer();
	const xlsx = new XlsxAnalyticsReportRenderer();
	const pdf = new PdfAnalyticsReportRenderer(testReportFontRegistry());

	it("has a renderer for every export format, producing that format", () => {
		const registry = new AnalyticsReportRendererRegistry(csv, xlsx, pdf);

		for (const format of AnalyticsExportFormatSchema.options) {
			expect(registry.rendererFor(format).format).toBe(format);
			expect(ANALYTICS_EXPORT_CONTENT_TYPES[format].length).toBeGreaterThan(0);
		}
	});

	it("refuses to boot with a renderer registered under the wrong format", () => {
		/** A PDF renderer that claims to produce XLSX — a wiring mistake the registry must catch. */
		class MisregisteredRenderer extends PdfAnalyticsReportRenderer {
			public constructor() {
				super(testReportFontRegistry());
			}

			public override readonly format: AnalyticsExportFormat = "xlsx";
		}

		expect(() => new AnalyticsReportRendererRegistry(csv, xlsx, new MisregisteredRenderer())).toThrow(AnalyticsRendererMismatchError);
	});
});
