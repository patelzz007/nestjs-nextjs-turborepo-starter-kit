import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { AnalyticsReportExporter } from "../../assemblers/analytics-report-exporter";
import type { ReportFile } from "../../ports/report-file.port";
import { ExportPlatformReportQuery } from "./export-platform-report.query";

@Injectable()
@QueryHandler(ExportPlatformReportQuery)
export class ExportPlatformReportHandler implements IQueryHandler<ExportPlatformReportQuery, ReportFile> {
	public constructor(
		private readonly dashboards: AnalyticsDashboardAssembler,
		private readonly exporter: AnalyticsReportExporter,
	) {}

	public async execute(query: ExportPlatformReportQuery): Promise<ReportFile> {
		const { input } = query;
		const dashboard = await this.dashboards.adminDashboard(input.query);
		return this.exporter.exportPlatform(dashboard, input.query.format, input.request);
	}
}
