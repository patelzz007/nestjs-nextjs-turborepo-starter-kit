import { Readable } from "node:stream";

import type { AnalyticsExportFormat, JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ReportExportAuditPort } from "../../ports/report-export-audit.port";
import type { AnalyticsReportRenderer, ReportRendererPort } from "../../ports/report-renderer.port";
import type { AnalyticsReport } from "../../reports/analytics-report";

/** Renders a report as its subject line, recording what it rendered. */
export class TextReportRenderers implements ReportRendererPort {
	public readonly rendered: { readonly format: AnalyticsExportFormat; readonly report: AnalyticsReport; readonly body: Readable }[] = [];

	public rendererFor(format: AnalyticsExportFormat): AnalyticsReportRenderer {
		return {
			format,
			render: (report: AnalyticsReport): Readable => {
				const body = Readable.from([`${format}:${report.subjectKey}`]);
				this.rendered.push({ format, report, body });
				return body;
			},
		};
	}
}

/** Thrown by {@link RecordingExportAudit} when it is set to fail. */
export class ExportAuditUnavailableForTest extends Error {
	public constructor() {
		super("audit store down");
		this.name = "ExportAuditUnavailableForTest";
	}
}

/** Records every export audit summary; can be made to fail. */
export class RecordingExportAudit implements ReportExportAuditPort {
	public fail = false;
	public readonly rows: { readonly request: FastifyRequest; readonly summary: JsonValue }[] = [];

	public recordExport(request: FastifyRequest, summary: JsonValue): Promise<void> {
		if (this.fail) {
			return Promise.reject(new ExportAuditUnavailableForTest());
		}
		this.rows.push({ request, summary });
		return Promise.resolve();
	}
}
