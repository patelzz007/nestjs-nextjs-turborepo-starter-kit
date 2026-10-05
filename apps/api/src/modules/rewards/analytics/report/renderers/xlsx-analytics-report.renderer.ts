import { PassThrough, type Readable, type Stream } from "node:stream";

import { Injectable } from "@nestjs/common";
import { assertNever, wallClockDateInTimeZone, type AnalyticsExportFormat, type SaleCurrency } from "@workspace/shared";
import writeXlsxFile, { type Cell, type Row, type Sheet } from "write-excel-file/node";

import type { AnalyticsReport, AnalyticsReportCell, AnalyticsReportColumn, AnalyticsReportTable, AnalyticsReportUnit } from "../analytics-report";
import { ANALYTICS_INTERVAL_LABELS, formatRange, formatTimestampUtc, minorToMajor } from "../report-format";
import type { AnalyticsReportRenderer } from "./analytics-report-renderer";

/** Excel number formats of each typed cell. */
export const XLSX_MONEY_FORMAT = "#,##0.00";
export const XLSX_COUNT_FORMAT = "#,##0";
export const XLSX_PERCENT_FORMAT = "0.0%";
export const XLSX_DATE_FORMAT = "yyyy-mm-dd";

/** Name of the KPI sheet (the first sheet). */
export const XLSX_SUMMARY_SHEET_NAME = "Summary";

/** Excel's limit on a sheet name. */
const MAX_SHEET_NAME_LENGTH = 31;

/** Header rows frozen at the top of every sheet (the column headers stay visible while scrolling). */
const FROZEN_HEADER_ROWS = 1;

/** Column width (characters) of a text column, and of every other column. */
const TEXT_COLUMN_WIDTH = 32;
const VALUE_COLUMN_WIDTH = 16;

/** Excel stores a percentage as a fraction (12.5 % = 0.125). */
const PERCENT_TO_FRACTION = 100;

const header = (value: string): Cell => ({ value, type: String, fontWeight: "bold" });

/** A value in its unit as a typed number cell (money in major units, a percentage as a fraction). */
function unitCell(value: number, unit: AnalyticsReportUnit, currency: SaleCurrency): Cell {
	switch (unit) {
		case "money":
			return { type: Number, value: minorToMajor(value, currency), format: XLSX_MONEY_FORMAT };
		case "count":
			return { type: Number, value, format: XLSX_COUNT_FORMAT };
		case "percent":
			return { type: Number, value: value / PERCENT_TO_FRACTION, format: XLSX_PERCENT_FORMAT };
	}
}

function headerOf(column: AnalyticsReportColumn, currency: SaleCurrency): string {
	return column.kind === "money" ? `${column.header} (${currency})` : column.header;
}

/**
 * XLSX export (`write-excel-file`): a "Summary" sheet with the typed KPIs and
 * the report's metadata, then one sheet per table. Every cell is typed —
 * money and counts are numbers with a number format, percentages are
 * fractions formatted `0.0%`, bucket starts are real dates showing the local
 * day of the report's time zone — and the header row of each sheet is frozen.
 * Text is written as shared strings, which a spreadsheet never evaluates as a
 * formula.
 */
@Injectable()
export class XlsxAnalyticsReportRenderer implements AnalyticsReportRenderer {
	public readonly format: AnalyticsExportFormat = "xlsx";

	public render(report: AnalyticsReport): Readable {
		const sheets: Sheet<Stream>[] = [this.summarySheet(report), ...report.tables.map((table) => this.tableSheet(table, report))];
		const output = new PassThrough();
		writeXlsxFile(sheets)
			.toStream(output)
			.catch((error: unknown) => {
				output.destroy(error instanceof Error ? error : new Error(String(error)));
			});
		return output;
	}

	private summarySheet(report: AnalyticsReport): Sheet<Stream> {
		const { currency, range } = report;
		const kpiRows: Row[] = report.kpis.map((kpi) => [
			{ type: String, value: kpi.unit === "money" ? `${kpi.label} (${currency})` : kpi.label },
			unitCell(kpi.comparison.value, kpi.unit, currency),
			unitCell(kpi.comparison.previous, kpi.unit, currency),
			unitCell(kpi.comparison.change, kpi.unit, currency),
			kpi.comparison.changePercent === null ? null : { type: Number, value: kpi.comparison.changePercent / PERCENT_TO_FRACTION, format: XLSX_PERCENT_FORMAT },
		]);
		const metadata: [string, string][] = [
			["Report", `${report.brand} — ${report.title}`],
			["Subject", report.subjectName],
			["Range", formatRange(range)],
			["Time zone", range.timeZone],
			["Interval", ANALYTICS_INTERVAL_LABELS[range.interval]],
			["Currency", currency],
			["Generated at", formatTimestampUtc(report.generatedAt)],
		];
		return {
			sheet: XLSX_SUMMARY_SHEET_NAME,
			stickyRowsCount: FROZEN_HEADER_ROWS,
			columns: [{ width: TEXT_COLUMN_WIDTH }, { width: VALUE_COLUMN_WIDTH }, { width: VALUE_COLUMN_WIDTH }, { width: VALUE_COLUMN_WIDTH }, { width: VALUE_COLUMN_WIDTH }],
			data: [
				[header("Metric"), header("Value"), header("Previous period"), header("Change"), header("Change %")],
				...kpiRows,
				[],
				...metadata.map(([label, value]): Row => [header(label), { type: String, value }]),
			],
		};
	}

	private tableSheet(table: AnalyticsReportTable, report: AnalyticsReport): Sheet<Stream> {
		return {
			sheet: table.title.slice(0, MAX_SHEET_NAME_LENGTH),
			stickyRowsCount: FROZEN_HEADER_ROWS,
			columns: table.columns.map((column) => ({ width: column.kind === "text" ? TEXT_COLUMN_WIDTH : VALUE_COLUMN_WIDTH })),
			data: [table.columns.map((column) => header(headerOf(column, report.currency))), ...table.rows.map((row): Row => row.map((cell) => this.cell(cell, report)))],
		};
	}

	private cell(cell: AnalyticsReportCell, report: AnalyticsReport): Cell {
		switch (cell.kind) {
			case "text":
				return { type: String, value: cell.value };
			case "count":
				return unitCell(cell.value, "count", report.currency);
			case "money":
				return unitCell(cell.minor, "money", report.currency);
			case "percent":
				return unitCell(cell.value, "percent", report.currency);
			case "date":
				return { type: Date, value: wallClockDateInTimeZone(cell.epochMs, report.range.timeZone), format: XLSX_DATE_FORMAT };
			case "boolean":
				return { type: Boolean, value: cell.value };
			default:
				return assertNever(cell, "report cell");
		}
	}
}
