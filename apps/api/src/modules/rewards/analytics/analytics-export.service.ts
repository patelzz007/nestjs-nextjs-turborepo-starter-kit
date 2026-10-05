import type { Readable } from "node:stream";

import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
	ANALYTICS_EXPORT_CONTENT_TYPES,
	analyticsExportFileName,
	type AdminAnalyticsExportQuery,
	type AnalyticsExportFormat,
	type MerchantAnalyticsExportQuery,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { ANALYTICS_CLOCK, AnalyticsDashboardService, type AnalyticsClock } from "./analytics-dashboard.service";
import { reportRowCounts, type AnalyticsReport } from "./report/analytics-report";
import { buildMerchantReport, buildPlatformReport } from "./report/analytics-report.builder";
import { AnalyticsReportRendererRegistry } from "./report/renderers/analytics-report-renderer.registry";

/** A rendered export, ready to stream: what the controller sends. */
export interface AnalyticsExportFile {
	readonly fileName: string;
	readonly contentType: string;
	readonly body: Readable;
}

/** Which report an audit row describes. */
type ExportedReportKind = "merchant" | "platform";

/**
 * Builds an analytics report ONCE (from the same dashboard the screens show),
 * renders it with the format's strategy, and records the export in the audit
 * trail before a single byte leaves the server. Authorization is the
 * dashboard's: merchant — `merchant:view_analytics` + store scope (enforced by
 * {@link AnalyticsDashboardService.buildMerchantDashboard}); admin —
 * `READ ANALYTICS` on the controller. The per-caller rate limit is the
 * route's `AnalyticsExportRateLimitGuard`.
 */
@Injectable()
export class AnalyticsExportService {
	public constructor(
		private readonly dashboards: AnalyticsDashboardService,
		private readonly renderers: AnalyticsReportRendererRegistry,
		private readonly auditTrail: AuditTrailService,
		private readonly config: TypedConfigService,
		@Inject(ANALYTICS_CLOCK) private readonly clock: AnalyticsClock,
	) {}

	/** The merchant report of `actor`'s organization (and store scope). `request` is the HTTP request the audit row describes. */
	public async exportMerchantReport(actor: MerchantActor, query: MerchantAnalyticsExportQuery, request: FastifyRequest): Promise<AnalyticsExportFile> {
		const { dashboard, subject } = await this.dashboards.buildMerchantDashboard(actor, query);
		const report = buildMerchantReport(dashboard, subject, this.provenance());
		return this.release("merchant", report, query.format, request);
	}

	/** The platform report (the controller has enforced `READ ANALYTICS`). */
	public async exportPlatformReport(query: AdminAnalyticsExportQuery, request: FastifyRequest): Promise<AnalyticsExportFile> {
		const dashboard = await this.dashboards.getAdminDashboard(query);
		const report = buildPlatformReport(dashboard, this.provenance());
		return this.release("platform", report, query.format, request);
	}

	private provenance(): { readonly brand: string; readonly generatedAt: number } {
		return { brand: this.config.runtime.appName, generatedAt: this.clock.nowEpochMs() };
	}

	/**
	 * Renders `report` (synchronous layout errors surface here, before any
	 * header is sent), then writes the audit row — only after both succeed is
	 * the stream handed to the controller.
	 */
	private async release(kind: ExportedReportKind, report: AnalyticsReport, format: AnalyticsExportFormat, request: FastifyRequest): Promise<AnalyticsExportFile> {
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
			await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
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
