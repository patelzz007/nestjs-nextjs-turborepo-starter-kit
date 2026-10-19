import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { MERCHANT_ACCESS, ORGANIZATION_READ, OrganizationAccessModule, type OrganizationReadPort } from "../organizations/public-api";
import { AnalyticsDashboardAssembler } from "./application/assemblers/analytics-dashboard.assembler";
import { AnalyticsReportExporter } from "./application/assemblers/analytics-report-exporter";
import { WeeklyAnalyticsAssembler } from "./application/assemblers/weekly-analytics.assembler";
import type { AnalyticsBreakdownReadPort } from "./application/ports/analytics-breakdown.port";
import type { AnalyticsFactsReadPort } from "./application/ports/analytics-facts.port";
import type { AnalyticsOrganizationReadPort } from "./application/ports/analytics-organization-read.port";
import type { ReportExportAuditPort } from "./application/ports/report-export-audit.port";
import type { RewardActivityReadPort } from "./application/ports/reward-activity-read.port";
import type { SalesReadPort } from "./application/ports/sales-read.port";
import {
	ANALYTICS_BREAKDOWN_READ,
	ANALYTICS_FACTS_READ,
	ANALYTICS_ORGANIZATION_READ,
	REPORT_BRAND,
	REPORT_EXPORT_AUDIT,
	REPORT_RENDERERS,
	REPORTING_MERCHANT_ACCESS,
	REWARD_ACTIVITY_READ,
	SALES_READ,
} from "./application/ports/reporting.tokens";
import { ExportMerchantReportHandler } from "./application/queries/export-merchant-report/export-merchant-report.handler";
import { ExportPlatformReportHandler } from "./application/queries/export-platform-report/export-platform-report.handler";
import { GetAdminDashboardHandler } from "./application/queries/get-admin-dashboard/get-admin-dashboard.handler";
import { GetAdminSalesAnalyticsHandler } from "./application/queries/get-admin-sales-analytics/get-admin-sales-analytics.handler";
import { GetConsumerClaimAnalyticsHandler } from "./application/queries/get-consumer-claim-analytics/get-consumer-claim-analytics.handler";
import { GetConsumerDashboardHandler } from "./application/queries/get-consumer-dashboard/get-consumer-dashboard.handler";
import { GetMerchantAnalyticsHandler } from "./application/queries/get-merchant-analytics/get-merchant-analytics.handler";
import { GetMerchantDashboardHandler } from "./application/queries/get-merchant-dashboard/get-merchant-dashboard.handler";
import { AuditTrailReportExportAdapter } from "./infrastructure/adapters/audit-trail-report-export.adapter";
import { OrganizationAnalyticsReadAdapter } from "./infrastructure/adapters/organization-analytics-read.adapter";
import { AnalyticsSqlRunner } from "./infrastructure/persistence/analytics-sql";
import { PrismaAnalyticsBreakdownReadRepository } from "./infrastructure/persistence/prisma-analytics-breakdown.read-repository";
import { PrismaAnalyticsFactsReadRepository } from "./infrastructure/persistence/prisma-analytics-facts.read-repository";
import { PrismaRewardActivityReadRepository } from "./infrastructure/persistence/prisma-reward-activity.read-repository";
import { PrismaSalesReadRepository } from "./infrastructure/persistence/prisma-sales.read-repository";
import { REPORT_FONT_LOADER_PROVIDER } from "./infrastructure/report/fonts/report-font-registry";
import { AnalyticsReportRendererRegistry } from "./infrastructure/report/renderers/analytics-report-renderer.registry";
import { CsvAnalyticsReportRenderer } from "./infrastructure/report/renderers/csv-analytics-report.renderer";
import { PdfAnalyticsReportRenderer } from "./infrastructure/report/renderers/pdf-analytics-report.renderer";
import { XlsxAnalyticsReportRenderer } from "./infrastructure/report/renderers/xlsx-analytics-report.renderer";
import { RewardsAdminAnalyticsController } from "./presentation/http/admin-analytics.controller";
import { AnalyticsExportRateLimitGuard } from "./presentation/http/analytics-export-rate-limit.guard";
import { ConsumerAnalyticsController } from "./presentation/http/consumer-analytics.controller";
import { OrganizationAnalyticsController } from "./presentation/http/organization-analytics.controller";

/**
 * Reporting: the analytics read side (queries only, plan §7.8). Dashboards (customer / merchant /
 * admin), the weekly analytics, and the merchant / admin report exports (CSV, XLSX, PDF). Every
 * number is a database aggregate; this context owns no model. The shared throttler store the export
 * rate limit counts in comes from the global `ThrottlerModule`; `AuditTrailService` from the global
 * audit module.
 */
@Module({
	imports: [PrismaModule, SystemCommandModule, OrganizationAccessModule],
	controllers: [OrganizationAnalyticsController, RewardsAdminAnalyticsController, ConsumerAnalyticsController],
	providers: [
		{ provide: REPORTING_MERCHANT_ACCESS, useExisting: MERCHANT_ACCESS },
		AnalyticsSqlRunner,
		{
			provide: ANALYTICS_FACTS_READ,
			inject: [AnalyticsSqlRunner],
			useFactory: (sql: AnalyticsSqlRunner): AnalyticsFactsReadPort => new PrismaAnalyticsFactsReadRepository(sql),
		},
		{
			provide: ANALYTICS_BREAKDOWN_READ,
			inject: [AnalyticsSqlRunner],
			useFactory: (sql: AnalyticsSqlRunner): AnalyticsBreakdownReadPort => new PrismaAnalyticsBreakdownReadRepository(sql),
		},
		{
			provide: SALES_READ,
			inject: [PrismaService, TenantTransactionService],
			useFactory: (prisma: PrismaService, transactions: TenantTransactionService): SalesReadPort => new PrismaSalesReadRepository(prisma, transactions),
		},
		{
			provide: REWARD_ACTIVITY_READ,
			inject: [PrismaService],
			useFactory: (prisma: PrismaService): RewardActivityReadPort => new PrismaRewardActivityReadRepository(prisma),
		},
		{
			provide: ANALYTICS_ORGANIZATION_READ,
			inject: [ORGANIZATION_READ],
			useFactory: (organizations: OrganizationReadPort): AnalyticsOrganizationReadPort => new OrganizationAnalyticsReadAdapter(organizations),
		},
		{
			provide: REPORT_EXPORT_AUDIT,
			inject: [AuditTrailService],
			useFactory: (auditTrail: AuditTrailService): ReportExportAuditPort => new AuditTrailReportExportAdapter(auditTrail),
		},
		{ provide: REPORT_BRAND, inject: [TypedConfigService], useFactory: (config: TypedConfigService): string => config.runtime.appName },
		REPORT_FONT_LOADER_PROVIDER,
		CsvAnalyticsReportRenderer,
		XlsxAnalyticsReportRenderer,
		PdfAnalyticsReportRenderer,
		AnalyticsReportRendererRegistry,
		{ provide: REPORT_RENDERERS, useExisting: AnalyticsReportRendererRegistry },
		AnalyticsDashboardAssembler,
		WeeklyAnalyticsAssembler,
		AnalyticsReportExporter,
		AnalyticsExportRateLimitGuard,
		GetMerchantAnalyticsHandler,
		GetMerchantDashboardHandler,
		ExportMerchantReportHandler,
		GetAdminSalesAnalyticsHandler,
		GetAdminDashboardHandler,
		ExportPlatformReportHandler,
		GetConsumerClaimAnalyticsHandler,
		GetConsumerDashboardHandler,
	],
})
export class ReportingModule {}
