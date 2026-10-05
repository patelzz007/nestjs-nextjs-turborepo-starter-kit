import type { Readable } from "node:stream";

import type { AnalyticsExportFormat } from "@workspace/shared";

import type { AnalyticsReport } from "../analytics-report";

/**
 * The port every export format implements (Strategy): lay one
 * {@link AnalyticsReport} out as a file, streamed. A renderer never queries
 * the database and never recomputes a number — everything it shows is in the
 * report. Its `Content-Type` and file extension are the shared
 * `ANALYTICS_EXPORT_CONTENT_TYPES` / `ANALYTICS_EXPORT_FILE_EXTENSIONS` of its
 * `format`. Adding a format = one class implementing this + one registry entry
 * (`AnalyticsReportRendererRegistry`).
 */
export interface AnalyticsReportRenderer {
	readonly format: AnalyticsExportFormat;
	/** The file's bytes. A failure while streaming destroys the stream with the error. */
	render(report: AnalyticsReport): Readable;
}
