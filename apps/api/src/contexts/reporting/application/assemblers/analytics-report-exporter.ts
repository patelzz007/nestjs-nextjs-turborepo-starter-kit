import { Inject, Injectable } from "@nestjs/common";
import {
	ANALYTICS_EXPORT_CONTENT_TYPES,
	analyticsExportFileName,
	type AdminAnalyticsDashboard,
	type AnalyticsExportFormat,
	type MerchantAnalyticsDashboard,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { MerchantDashboardSubject } from "../ports/analytics-tenant-read.port";
import type { ReportExportAuditPort } from "../ports/report-export-audit.port";
import type { ReportFile } from "../ports/report-file.port";
import type { ReportRendererPort } from "../ports/report-renderer.port";
import { REPORT_BRAND, REPORT_EXPORT_AUDIT, REPORT_RENDERERS } from "../ports/reporting.tokens";
import { reportRowCounts, type AnalyticsReport } from "../reports/analytics-report";
import { buildMerchantReport, buildPlatformReport, type ReportProvenance } from "../reports/analytics-report.builder";

/** Which report an audit row describes. */
type ExportedReportKind = "merchant" | "platform";

/**
 * Builds an analytics report ONCE (from the same dashboard the screens show),
 * renders it with the format's strategy, and records the export in the audit
 * trail before a single byte leaves the server. Authorization is the
 * dashboard's, done by the calling query handler. The per-caller rate limit is
 * the route's `AnalyticsExportRateLimitGuard`.
 */
@Injectable()
export class AnalyticsReportExporter {
	public constructor(
		@Inject(REPORT_RENDERERS) private readonly renderers: ReportRendererPort,
		@Inject(REPORT_EXPORT_AUDIT) private readonly audit: ReportExportAuditPort,
		@Inject(REPORT_BRAND) private readonly brand: string,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	/** The merchant report file of an (already authorized) dashboard. `request` is the HTTP request the audit row describes. */
	public async exportMerchant(
		dashboard: MerchantAnalyticsDashboard,
		subject: MerchantDashboardSubject,
		format: AnalyticsExportFormat,
		request: FastifyRequest,
	): Promise<ReportFile> {
		return this.release("merchant", buildMerchantReport(dashboard, subject, this.provenance()), format, request);
	}

	/** The platform report file (the route has enforced `READ ANALYTICS`). */
	public async exportPlatform(dashboard: AdminAnalyticsDashboard, format: AnalyticsExportFormat, request: FastifyRequest): Promise<ReportFile> {
		return this.release("platform", buildPlatformReport(dashboard, this.provenance()), format, request);
	}

	private provenance(): ReportProvenance {
		return { brand: this.brand, generatedAt: this.clock.now() };
	}

	/**
	 * Renders `report` (synchronous layout errors surface here, before any
	 * header is sent), then writes the audit row — only after both succeed is
	 * the stream handed to the controller.
	 */
	private async release(kind: ExportedReportKind, report: AnalyticsReport, format: AnalyticsExportFormat, request: FastifyRequest): Promise<ReportFile> {
		const fileName = analyticsExportFileName({
			subject: report.subjectKey,
			fromMs: report.range.from,
			toMs: report.range.to,
			timeZone: report.range.timeZone,
			interval: report.range.interval,
			format,
		});
		const body = this.renderers.rendererFor(format).render(report);
		try {
			await this.audit.recordExport(request, {
				export: {
					report: kind,
					subject: report.subjectKey,
					format,
					fileName,
					from: report.range.from,
					to: report.range.to,
					timeZone: report.range.timeZone,
					interval: report.range.interval,
					rowCounts: reportRowCounts(report),
				},
			});
		} catch (error) {
			body.destroy();
			throw error;
		}
		return { fileName, contentType: ANALYTICS_EXPORT_CONTENT_TYPES[format], body };
	}
}
