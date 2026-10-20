import { Controller, Get, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MerchantAnalyticsDashboardQuerySchema,
	MerchantAnalyticsDashboardSchema,
	MerchantAnalyticsExportQuerySchema,
	MerchantAnalyticsResponseSchema,
	TenantSlugParamSchema,
	RewardsAnalyticsQuerySchema,
	type MerchantAnalyticsDashboard,
	type MerchantAnalyticsResponse,
} from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodFileResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { ExportMerchantReportQuery } from "../../application/queries/export-merchant-report/export-merchant-report.query";
import { GetMerchantAnalyticsQuery } from "../../application/queries/get-merchant-analytics/get-merchant-analytics.query";
import { GetMerchantDashboardQuery } from "../../application/queries/get-merchant-dashboard/get-merchant-dashboard.query";
import { ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION, ANALYTICS_EXPORT_OPERATION_DESCRIPTION } from "./analytics-api-docs";
import { AnalyticsExportRateLimitGuard } from "./analytics-export-rate-limit.guard";
import { sendReportFile } from "./report-file.reply";

/**
 * The tenant's analytics, for signed-in members (`:tenantSlug`). An integration API key uses
 * `/integration/analytics` instead: a machine credential names no tenant (D6).
 */
@ApiTags("Tenant Analytics")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/analytics"))
export class TenantAnalyticsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Tenant reward performance analytics" })
	@ZodResponse(MerchantAnalyticsResponseSchema, { description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodQuery(RewardsAnalyticsQuerySchema) query: z.output<typeof RewardsAnalyticsQuerySchema>,
	): Promise<MerchantAnalyticsResponse> {
		return this.queryBus.execute(new GetMerchantAnalyticsQuery(actor, { tenantId: merchant.tenantId, query }));
	}

	/**
	 * Auth: member session. Authorization: `merchant:view_analytics`, data
	 * limited to the caller's store scope (a store-limited member never sees
	 * another store).
	 */
	@SkipAuthThrottle()
	@Get("dashboard")
	@ApiOperation({
		summary: "Merchant analytics dashboard: custom range + interval, compared totals, series, store / reward / redemption-method breakdowns",
		description: ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION,
	})
	@ZodResponse(MerchantAnalyticsDashboardSchema, { description: "Merchant analytics dashboard" })
	public getDashboard(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodQuery(MerchantAnalyticsDashboardQuerySchema) query: z.output<typeof MerchantAnalyticsDashboardQuerySchema>,
	): Promise<MerchantAnalyticsDashboard> {
		return this.queryBus.execute(new GetMerchantDashboardQuery(actor, { tenantId: merchant.tenantId, query }));
	}

	/**
	 * The dashboard's report as a CSV / XLSX / PDF file. Same authorization and
	 * store scope as the dashboard; rate-limited per caller
	 * (`ANALYTICS_EXPORT_RATE_LIMIT`); every export writes an audit row.
	 */
	@SkipAuthThrottle()
	@UseGuards(AnalyticsExportRateLimitGuard)
	@Get("export")
	@ApiOperation({
		summary: "Download the merchant analytics report (csv | xlsx | pdf) for a date range",
		description: ANALYTICS_EXPORT_OPERATION_DESCRIPTION,
	})
	@ZodFileResponse(apiContract.tenants.analyticsExport.response, { description: "The report file (Content-Disposition: attachment)" })
	public async exportReport(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodQuery(MerchantAnalyticsExportQuerySchema) query: z.output<typeof MerchantAnalyticsExportQuerySchema>,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendReportFile(reply, await this.queryBus.execute(new ExportMerchantReportQuery(actor, { tenantId: merchant.tenantId, query, request })));
	}
}
