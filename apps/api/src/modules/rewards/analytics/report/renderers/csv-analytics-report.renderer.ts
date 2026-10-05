import { Readable } from "node:stream";

import { Injectable } from "@nestjs/common";
import { assertNever, localDateInTimeZone, type AnalyticsExportFormat, type SaleCurrency } from "@workspace/shared";

import type { AnalyticsReport, AnalyticsReportCell, AnalyticsReportColumn, AnalyticsReportUnit } from "../analytics-report";
import { ANALYTICS_INTERVAL_LABELS, formatRange, formatTimestampUtc, minorToDecimalString } from "../report-format";
import type { AnalyticsReportRenderer } from "./analytics-report-renderer";

/** UTF-8 byte-order mark: makes Excel open the file as UTF-8 (otherwise "Café" turns into mojibake). */
export const CSV_UTF8_BOM = "﻿";

/** RFC 4180 record separator. */
const CSV_LINE_BREAK = "\r\n";

/** A field containing any of these must be quoted (RFC 4180 §2.6). */
const CSV_NEEDS_QUOTING = /[",\r\n]/;

/**
 * A spreadsheet treats a cell starting with one of these as a formula (CSV
 * injection, OWASP). Text cells that start with one are prefixed with `'`, so
 * a reward titled `=HYPERLINK(…)` is shown as text, never evaluated.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Prefix that turns a would-be formula into plain text. */
const FORMULA_ESCAPE_PREFIX = "'";

/** Decimal places of a percentage cell. */
const PERCENT_DECIMALS = 1;

/** Neutralises a spreadsheet formula at the start of a TEXT cell (numbers we generate are never prefixed). */
export function protectFromFormula(value: string): string {
	return FORMULA_TRIGGER.test(value) ? `${FORMULA_ESCAPE_PREFIX}${value}` : value;
}

/** RFC 4180 field: quoted (with `"` doubled) when it contains a quote, a comma, CR or LF. */
export function escapeCsvField(value: string): string {
	return CSV_NEEDS_QUOTING.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** One RFC 4180 record (CRLF-terminated). */
export function csvRecord(fields: readonly string[]): string {
	return `${fields.map(escapeCsvField).join(",")}${CSV_LINE_BREAK}`;
}

/** A number in its unit, locale-free (money as a fixed-decimal major-unit amount). */
function unitValue(value: number, unit: AnalyticsReportUnit, currency: SaleCurrency): string {
	switch (unit) {
		case "money":
			return minorToDecimalString(value, currency);
		case "count":
			return String(value);
		case "percent":
			return value.toFixed(PERCENT_DECIMALS);
	}
}

/** A KPI label naming its unit: "Sales (MYR)", "Conversion rate (%)", "Bills". */
function kpiLabel(label: string, unit: AnalyticsReportUnit, currency: SaleCurrency): string {
	switch (unit) {
		case "money":
			return `${label} (${currency})`;
		case "percent":
			return `${label} (%)`;
		case "count":
			return label;
	}
}

/** A table header naming its unit, so a bare number is never ambiguous: "Sales (MYR)", "Conversion (%)". */
function headerOf(column: AnalyticsReportColumn, currency: SaleCurrency): string {
	switch (column.kind) {
		case "money":
			return `${column.header} (${currency})`;
		case "percent":
			return `${column.header} (%)`;
		case "date":
		case "text":
		case "count":
		case "boolean":
			return column.header;
		default:
			return assertNever(column.kind, "report column kind");
	}
}

/**
 * CSV export (RFC 4180, UTF-8 with BOM, CRLF). One file, sections one after
 * another separated by an empty record: report metadata, the KPI summary,
 * then every table with its title and header row. Money is a fixed-decimal
 * amount in major units (header names the currency), dates are calendar dates
 * in the report's time zone, text cells are protected against formula
 * injection.
 */
@Injectable()
export class CsvAnalyticsReportRenderer implements AnalyticsReportRenderer {
	public readonly format: AnalyticsExportFormat = "csv";

	public render(report: AnalyticsReport): Readable {
		return Readable.from(this.records(report), { objectMode: false });
	}

	private *records(report: AnalyticsReport): Generator<Buffer> {
		const { currency, range } = report;
		const text = (value: string): string => protectFromFormula(value);
		yield Buffer.from(CSV_UTF8_BOM, "utf8");
		yield this.encode([text(`${report.brand} — ${report.title}`)]);
		yield this.encode(["Subject", text(report.subjectName)]);
		yield this.encode(["Range", formatRange(range)]);
		yield this.encode(["Time zone", range.timeZone]);
		yield this.encode(["Interval", ANALYTICS_INTERVAL_LABELS[range.interval]]);
		yield this.encode(["Currency", currency]);
		yield this.encode(["Generated at", formatTimestampUtc(report.generatedAt)]);
		yield this.encode([]);
		yield this.encode(["Summary"]);
		yield this.encode(["Metric", "Value", "Previous period", "Change", "Change (%)"]);
		for (const kpi of report.kpis) {
			const { comparison, unit } = kpi;
			yield this.encode([
				kpiLabel(kpi.label, unit, currency),
				unitValue(comparison.value, unit, currency),
				unitValue(comparison.previous, unit, currency),
				unitValue(comparison.change, unit, currency),
				comparison.changePercent === null ? "" : comparison.changePercent.toFixed(PERCENT_DECIMALS),
			]);
		}
		for (const table of report.tables) {
			yield this.encode([]);
			yield this.encode([table.title]);
			yield this.encode(table.columns.map((column) => headerOf(column, currency)));
			for (const row of table.rows) {
				yield this.encode(row.map((cell) => this.cell(cell, report)));
			}
		}
	}

	private cell(cell: AnalyticsReportCell, report: AnalyticsReport): string {
		switch (cell.kind) {
			case "text":
				return protectFromFormula(cell.value);
			case "count":
				return String(cell.value);
			case "money":
				return minorToDecimalString(cell.minor, report.currency);
			case "percent":
				return cell.value.toFixed(PERCENT_DECIMALS);
			case "date":
				return localDateInTimeZone(cell.epochMs, report.range.timeZone);
			case "boolean":
				return cell.value ? "yes" : "no";
			default:
				return assertNever(cell, "report cell");
		}
	}

	private encode(fields: readonly string[]): Buffer {
		return Buffer.from(csvRecord(fields), "utf8");
	}
}
