import { Get, Req, Res, UseGuards } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AdminAnalyticsDashboardSchema,
	AdminSalesAnalyticsResponseSchema,
	apiContract,
	type AdminAnalyticsDashboard,
	type AdminSalesAnalyticsResponse,
} from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodFileResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ExportPlatformReportQuery } from "../../application/queries/export-platform-report/export-platform-report.query";
import { AnalyticsDashboardAssembler } from "../../application/assemblers/analytics-dashboard.assembler";
import { WeeklyAnalyticsAssembler } from "../../application/assemblers/weekly-analytics.assembler";
import { ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION, ANALYTICS_EXPORT_OPERATION_DESCRIPTION } from "./analytics-api-docs";
import { AnalyticsExportRateLimitGuard } from "./analytics-export-rate-limit.guard";
import { sendReportFile } from "./report-file.reply";
import { PLATFORM_ANALYTICS_READ_OPERATION } from "../../application/ports/reporting.tokens";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@PlatformOperation(PLATFORM_ANALYTICS_READ_OPERATION)
@ApiController("/admin/analytics")
export class RewardsAdminAnalyticsController {
	public constructor(
		private readonly queryBus: QueryBus,
		private readonly weekly: WeeklyAnalyticsAssembler,
		private readonly dashboards: AnalyticsDashboardAssembler,
	) {}

	@RequirePermission("READ", "ANALYTICS")
	@Get("sales")
	@ApiOperation({ summary: "Platform-wide sales: paid POS bills, compared with the previous period, plus top merchants" })
	@ZodResponse(AdminSalesAnalyticsResponseSchema, { description: "Platform sales analytics" })
	public getSales(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.rewardsAdmin.salesAnalytics.input) query: z.output<typeof apiContract.rewardsAdmin.salesAnalytics.input>,
	): Promise<AdminSalesAnalyticsResponse> {
		return this.weekly.adminSalesAnalytics(actor, query);
	}

	/** Authorization: `READ ANALYTICS` (platform admins); platform-wide, buckets in UTC. */
	@RequirePermission("READ", "ANALYTICS")
	@Get("dashboard")
	@ApiOperation({
		summary: "Platform analytics dashboard: custom range + interval, compared totals, series, top merchants, categories, cities, new vs returning customers",
		description: ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION,
	})
	@ZodResponse(AdminAnalyticsDashboardSchema, { description: "Platform analytics dashboard" })
	public getDashboard(
		@ZodQuery(apiContract.rewardsAdmin.analyticsDashboard.input) query: z.output<typeof apiContract.rewardsAdmin.analyticsDashboard.input>,
	): Promise<AdminAnalyticsDashboard> {
		return this.dashboards.adminDashboard(query);
	}

	/** Authorization: `READ ANALYTICS`. Rate-limited per admin (`ANALYTICS_EXPORT_RATE_LIMIT`); every export writes an audit row. */
	@RequirePermission("READ", "ANALYTICS")
	@UseGuards(AnalyticsExportRateLimitGuard)
	@Get("export")
	@ApiOperation({
		summary: "Download the platform analytics report (csv | xlsx | pdf) for a date range",
		description: ANALYTICS_EXPORT_OPERATION_DESCRIPTION,
	})
	@ZodFileResponse(apiContract.rewardsAdmin.analyticsExport.response, { description: "The report file (Content-Disposition: attachment)" })
	public async exportReport(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.rewardsAdmin.analyticsExport.input) query: z.output<typeof apiContract.rewardsAdmin.analyticsExport.input>,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendReportFile(reply, await this.queryBus.execute(new ExportPlatformReportQuery(actor, { query, request })));
	}
}
