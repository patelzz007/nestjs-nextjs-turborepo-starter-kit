// ============================================
// analytics-report.ts — the ONE report model every export format renders
// ============================================
// Built once from a dashboard (analytics-report.builder.ts), then handed to a
// format strategy (`AnalyticsReportRenderer`: CSV, XLSX, PDF). A renderer only
// lays this model out — it never queries the database and never recomputes a
// number, so the three formats always agree with each other and with the
// dashboard the user was looking at.

import type { AnalyticsComparison, AnalyticsReportRange, SaleCurrency } from "@workspace/shared";

/**
 * One table cell, typed by what it holds so every format can render it
 * natively (a spreadsheet number, a currency, a date …). A renderer switches
 * on `kind` with `assertNever`, so adding a kind fails to compile until every
 * format handles it.
 */
export type AnalyticsReportCell =
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "count"; readonly value: number }
	/** Integer minor units of the report's currency. */
	| { readonly kind: "money"; readonly minor: number }
	/** A percentage: 12.5 = 12.5 %. */
	| { readonly kind: "percent"; readonly value: number }
	/** An instant shown as its calendar date in the report's time zone (a bucket start). */
	| { readonly kind: "date"; readonly epochMs: number }
	| { readonly kind: "boolean"; readonly value: boolean };

export type AnalyticsReportCellKind = AnalyticsReportCell["kind"];

/** A column: its header and the kind of every cell in it. */
export interface AnalyticsReportColumn {
	readonly header: string;
	readonly kind: AnalyticsReportCellKind;
}

/** One section of the report (a series or a breakdown), rendered as a table / sheet. */
export interface AnalyticsReportTable {
	/** Stable machine key (`series`, `stores`, …) — the audit row counts rows per key. */
	readonly key: string;
	readonly title: string;
	readonly columns: readonly AnalyticsReportColumn[];
	readonly rows: readonly (readonly AnalyticsReportCell[])[];
}

/** What a KPI's numbers are: money (minor units), a count, or a percentage. */
export type AnalyticsReportUnit = "money" | "count" | "percent";

/** One headline number, compared with the previous range of equal length. */
export interface AnalyticsReportKpi {
	readonly label: string;
	readonly unit: AnalyticsReportUnit;
	readonly comparison: AnalyticsComparison;
}

/** One line / bar series of a chart: a value per bucket start. */
export interface AnalyticsReportChartSeries {
	readonly label: string;
	readonly points: readonly { readonly start: number; readonly value: number }[];
}

/** A chart of the report's main series (drawn as vector graphics in the PDF). */
export interface AnalyticsReportChart {
	readonly title: string;
	readonly kind: "bar" | "line";
	/** Unit of every series in the chart (one value axis). */
	readonly unit: Exclude<AnalyticsReportUnit, "percent">;
	readonly series: readonly AnalyticsReportChartSeries[];
}

/** The whole report. */
export interface AnalyticsReport {
	/** Product name shown on the report (the API's `APP_NAME`). */
	readonly brand: string;
	readonly title: string;
	/** Whose report: the merchant's display name, or "All merchants". */
	readonly subjectName: string;
	/** File-name subject: the organization slug, or `platform`. */
	readonly subjectKey: string;
	readonly generatedAt: number;
	readonly range: AnalyticsReportRange;
	readonly currency: SaleCurrency;
	readonly kpis: readonly AnalyticsReportKpi[];
	readonly charts: readonly AnalyticsReportChart[];
	readonly tables: readonly AnalyticsReportTable[];
}

/** Rows per table key — what the export's audit row records. */
export function reportRowCounts(report: AnalyticsReport): Record<string, number> {
	return Object.fromEntries(report.tables.map((table) => [table.key, table.rows.length]));
}
