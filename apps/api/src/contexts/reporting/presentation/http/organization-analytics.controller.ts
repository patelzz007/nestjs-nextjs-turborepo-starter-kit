import { Controller, Get, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MerchantAnalyticsDashboardQuerySchema,
	MerchantAnalyticsDashboardSchema,
	MerchantAnalyticsExportQuerySchema,
	MerchantAnalyticsResponseSchema,
	OrganizationSlugParamSchema,
	RewardsAnalyticsQuerySchema,
	type MerchantAnalyticsDashboard,
	type MerchantAnalyticsResponse,
} from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AllowApiKeyAuth } from "../../../../platform/presentation/http/security/decorators/allow-api-key-auth.decorator";
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

@ApiTags("Organization Analytics")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/analytics"))
export class OrganizationAnalyticsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Organization reward performance analytics" })
	@ZodResponse(MerchantAnalyticsResponseSchema, { description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(RewardsAnalyticsQuerySchema) query: z.output<typeof RewardsAnalyticsQuerySchema>,
	): Promise<MerchantAnalyticsResponse> {
		return this.queryBus.execute(new GetMerchantAnalyticsQuery(actor, { organizationId: merchant.organizationId, query }));
	}

	/**
	 * Auth: member session or organization API key. Authorization:
	 * `merchant:view_analytics`, data limited to the caller's store scope
	 * (a store-limited member / store-scoped key never sees another store).
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
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(MerchantAnalyticsDashboardQuerySchema) query: z.output<typeof MerchantAnalyticsDashboardQuerySchema>,
	): Promise<MerchantAnalyticsDashboard> {
		return this.queryBus.execute(new GetMerchantDashboardQuery(actor, { organizationId: merchant.organizationId, query }));
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
	@ZodFileResponse(apiContract.organizations.analyticsExport.response, { description: "The report file (Content-Disposition: attachment)" })
	public async exportReport(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(MerchantAnalyticsExportQuerySchema) query: z.output<typeof MerchantAnalyticsExportQuerySchema>,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendReportFile(reply, await this.queryBus.execute(new ExportMerchantReportQuery(actor, { organizationId: merchant.organizationId, query, request })));
	}
}
