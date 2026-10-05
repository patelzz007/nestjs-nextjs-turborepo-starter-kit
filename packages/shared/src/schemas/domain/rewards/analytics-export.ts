// ============================================
// analytics-export.ts — downloadable analytics reports (CSV / XLSX / PDF) for merchants and admins
// ============================================
// `GET /orgs/:orgSlug/analytics/export` and `GET /admin/analytics/export`
// answer the FILE itself (not the JSON envelope): `Content-Type` from
// {@link ANALYTICS_EXPORT_CONTENT_TYPES}, `Content-Disposition: attachment` with
// the name from {@link analyticsExportFileName}, `Cache-Control: no-store`.
// Errors keep the standard JSON error envelope. See docs/technical/api/analytics.md.

import { z } from "zod";

import { OrganizationLocationFilterSchema } from "../organization/location-filter";
import { analyticsExportRangeShape, type AnalyticsInterval, validateAnalyticsRange } from "./analytics-range";
import { localDateInTimeZone } from "./analytics-time-zone";

/** The file formats a report can be exported in. Adding one = a value here + one renderer class + one registry entry in the API. */
export const AnalyticsExportFormatSchema = z.enum(["csv", "xlsx", "pdf"]).meta({ description: "File format of the export", example: "xlsx" });

export type AnalyticsExportFormat = z.output<typeof AnalyticsExportFormatSchema>;

/** `Content-Type` of each export format. */
export const ANALYTICS_EXPORT_CONTENT_TYPES: Readonly<Record<AnalyticsExportFormat, string>> = {
	csv: "text/csv; charset=utf-8",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	pdf: "application/pdf",
};

/** File extension of each export format (without the dot). */
export const ANALYTICS_EXPORT_FILE_EXTENSIONS: Readonly<Record<AnalyticsExportFormat, string>> = {
	csv: "csv",
	xlsx: "xlsx",
	pdf: "pdf",
};

/** `GET /orgs/:orgSlug/analytics/export` — same range + store rules as the merchant dashboard; `from` and `to` are required. */
export const MerchantAnalyticsExportQuerySchema = z
	.object({ ...analyticsExportRangeShape, ...OrganizationLocationFilterSchema.shape, format: AnalyticsExportFormatSchema })
	.strict()
	.superRefine(validateAnalyticsRange);

export type MerchantAnalyticsExportQuery = z.output<typeof MerchantAnalyticsExportQuerySchema>;

/** `GET /admin/analytics/export` — the platform report; `from` and `to` are required. */
export const AdminAnalyticsExportQuerySchema = z
	.object({ ...analyticsExportRangeShape, format: AnalyticsExportFormatSchema })
	.strict()
	.superRefine(validateAnalyticsRange);

export type AdminAnalyticsExportQuery = z.output<typeof AdminAnalyticsExportQuerySchema>;

/**
 * Exports one user (or API key) may start per window. A person exporting a
 * month in all three formats plus a few other ranges stays well inside; each
 * export runs the full set of range aggregates and renders a document, so the
 * limit keeps one caller from monopolising the database. Exceeding it answers
 * `429 ANALYTICS_EXPORT_RATE_LIMITED` with `Retry-After`.
 */
export const ANALYTICS_EXPORT_RATE_LIMIT = 10;

/** The window of {@link ANALYTICS_EXPORT_RATE_LIMIT}. */
export const ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS = 600_000;

/** Machine codes an analytics dashboard / export can answer with besides the standard ones. */
export const AnalyticsErrorCodeSchema = z.enum([
	/** 429 — the caller used up {@link ANALYTICS_EXPORT_RATE_LIMIT} exports in the window; `details.retryAfterSeconds` says when to retry. */
	"ANALYTICS_EXPORT_RATE_LIMITED",
	/** 503 — a report query ran past its time budget; retry with a shorter range or a coarser interval. */
	"ANALYTICS_QUERY_TIMEOUT",
]);

export type AnalyticsErrorCode = z.output<typeof AnalyticsErrorCodeSchema>;

/** Characters kept in a file-name segment; anything else becomes `-`. */
const UNSAFE_FILE_NAME_SEGMENT = /[^a-z0-9-]+/g;
/** Longest subject segment kept in a file name. */
const MAX_FILE_NAME_SUBJECT_LENGTH = 64;
/** Prefix of every export file name. */
const EXPORT_FILE_NAME_PREFIX = "analytics";

/** The file-name subject of the admin's platform-wide report. */
export const ADMIN_ANALYTICS_EXPORT_SUBJECT = "platform";

/** What an export's file name is built from. */
export interface AnalyticsExportFileNameInput {
	/** The organization's slug, or {@link ADMIN_ANALYTICS_EXPORT_SUBJECT} for the admin report. */
	readonly subject: string;
	readonly fromMs: number;
	/** Exclusive end — the name shows the last day INCLUDED. */
	readonly toMs: number;
	readonly timeZone: string;
	readonly interval: AnalyticsInterval;
	readonly format: AnalyticsExportFormat;
}

/** Lower-cases `value` and keeps only `[a-z0-9-]`, so the name is safe in every OS and in a header. */
function fileNameSegment(value: string): string {
	const cleaned = value
		.toLowerCase()
		.replace(UNSAFE_FILE_NAME_SEGMENT, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned.slice(0, MAX_FILE_NAME_SUBJECT_LENGTH) || "report";
}

/**
 * The deterministic download name of an export:
 * `analytics_<subject>_<first day>_<last day>_<interval>.<ext>`, days in the
 * report's time zone — e.g. `analytics_brew-and-bean-kl_2026-09-01_2026-09-30_day.xlsx`.
 */
export function analyticsExportFileName(input: AnalyticsExportFileNameInput): string {
	const firstDay = localDateInTimeZone(input.fromMs, input.timeZone);
	const lastDay = localDateInTimeZone(input.toMs - 1, input.timeZone);
	return `${EXPORT_FILE_NAME_PREFIX}_${fileNameSegment(input.subject)}_${firstDay}_${lastDay}_${input.interval}.${ANALYTICS_EXPORT_FILE_EXTENSIONS[input.format]}`;
}
