import { Injectable } from "@nestjs/common";
import { AnalyticsExportFormatSchema, type AnalyticsExportFormat } from "@workspace/shared";

import type { AnalyticsReportRenderer } from "./analytics-report-renderer";
import { CsvAnalyticsReportRenderer } from "./csv-analytics-report.renderer";
import { PdfAnalyticsReportRenderer } from "./pdf-analytics-report.renderer";
import { XlsxAnalyticsReportRenderer } from "./xlsx-analytics-report.renderer";

/** A renderer was registered under a format it does not produce — a wiring bug caught at boot. */
export class AnalyticsRendererMismatchError extends Error {
	public constructor(key: AnalyticsExportFormat, actual: AnalyticsExportFormat) {
		super(`The "${key}" analytics renderer produces "${actual}"`);
		this.name = "AnalyticsRendererMismatchError";
	}
}

/**
 * The export format → renderer map (Open/Closed: a new format is one renderer
 * class plus one entry here — the `Record` type makes a missing entry a compile
 * error once the format exists in `AnalyticsExportFormatSchema`).
 */
@Injectable()
export class AnalyticsReportRendererRegistry {
	private readonly renderers: Readonly<Record<AnalyticsExportFormat, AnalyticsReportRenderer>>;

	public constructor(csv: CsvAnalyticsReportRenderer, xlsx: XlsxAnalyticsReportRenderer, pdf: PdfAnalyticsReportRenderer) {
		this.renderers = { csv, xlsx, pdf };
		for (const format of AnalyticsExportFormatSchema.options) {
			const renderer = this.renderers[format];
			if (renderer.format !== format) {
				throw new AnalyticsRendererMismatchError(format, renderer.format);
			}
		}
	}

	public rendererFor(format: AnalyticsExportFormat): AnalyticsReportRenderer {
		return this.renderers[format];
	}
}
