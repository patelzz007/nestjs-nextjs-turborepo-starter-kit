import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { authorizeMerchantAnalytics } from "../../assemblers/merchant-analytics-access";
import { REPORTING_MERCHANT_ACCESS } from "../../ports/reporting.tokens";
import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { AnalyticsReportExporter } from "../../assemblers/analytics-report-exporter";
import type { ReportFile } from "../../ports/report-file.port";
import { ExportMerchantReportQuery } from "./export-merchant-report.query";

@Injectable()
@QueryHandler(ExportMerchantReportQuery)
export class ExportMerchantReportHandler implements IQueryHandler<ExportMerchantReportQuery, ReportFile> {
	public constructor(
		@Inject(REPORTING_MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		private readonly dashboards: AnalyticsDashboardAssembler,
		private readonly exporter: AnalyticsReportExporter,
	) {}

	public async execute(query: ExportMerchantReportQuery): Promise<ReportFile> {
		const { actor, input } = query;
		const scope = await authorizeMerchantAnalytics(this.merchantAccess, actor, { organizationId: input.organizationId, locationId: input.query.locationId });
		const { dashboard, subject } = await this.dashboards.merchantDashboard(input.organizationId, scope, input.query);
		return this.exporter.exportMerchant(dashboard, subject, input.query.format, input.request);
	}
}
