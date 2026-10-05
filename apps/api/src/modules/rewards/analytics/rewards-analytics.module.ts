import { Module } from "@nestjs/common";

import { PrismaModule } from "../../../prisma/prisma.module";
import { AuthModule } from "../../auth/auth.module";
import { OrganizationModule } from "../../organization/organization.module";
import { RewardsCoreServicesModule } from "../rewards-core-services.module";
import { ANALYTICS_CLOCK, AnalyticsDashboardService, SYSTEM_ANALYTICS_CLOCK } from "./analytics-dashboard.service";
import { AnalyticsBreakdownRepository } from "./analytics-breakdown.repository";
import { AnalyticsExportRateLimitGuard } from "./analytics-export-rate-limit.guard";
import { AnalyticsExportService } from "./analytics-export.service";
import { AnalyticsFactsRepository } from "./analytics-facts.repository";
import { AnalyticsSqlRunner } from "./analytics-sql";
import { REPORT_FONT_REGISTRY_PROVIDER } from "./report/fonts/report-font-registry";
import { AnalyticsReportRendererRegistry } from "./report/renderers/analytics-report-renderer.registry";
import { CsvAnalyticsReportRenderer } from "./report/renderers/csv-analytics-report.renderer";
import { PdfAnalyticsReportRenderer } from "./report/renderers/pdf-analytics-report.renderer";
import { XlsxAnalyticsReportRenderer } from "./report/renderers/xlsx-analytics-report.renderer";

/**
 * Analytics dashboards (customer / merchant / admin) and the merchant / admin
 * report exports (CSV, XLSX, PDF). The HTTP routes live on the rewards
 * controllers; this module owns the SQL aggregates, the report model and the
 * format strategies. AuthModule provides the shared throttler store the export
 * rate limit counts in.
 */
@Module({
	imports: [PrismaModule, AuthModule, OrganizationModule, RewardsCoreServicesModule],
	providers: [
		AnalyticsSqlRunner,
		AnalyticsFactsRepository,
		AnalyticsBreakdownRepository,
		AnalyticsDashboardService,
		{ provide: ANALYTICS_CLOCK, useValue: SYSTEM_ANALYTICS_CLOCK },
		REPORT_FONT_REGISTRY_PROVIDER,
		CsvAnalyticsReportRenderer,
		XlsxAnalyticsReportRenderer,
		PdfAnalyticsReportRenderer,
		AnalyticsReportRendererRegistry,
		AnalyticsExportService,
		AnalyticsExportRateLimitGuard,
	],
	exports: [AnalyticsDashboardService, AnalyticsExportService, AnalyticsExportRateLimitGuard],
})
export class RewardsAnalyticsModule {}
