import { Controller, Get, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	MerchantAnalyticsDashboardQuerySchema,
	MerchantAnalyticsDashboardSchema,
	MerchantAnalyticsExportQuerySchema,
	MerchantAnalyticsResponseSchema,
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
import { ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodFileResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { ExportMerchantReportQuery } from "../../application/queries/export-merchant-report/export-merchant-report.query";
import { GetMerchantAnalyticsQuery } from "../../application/queries/get-merchant-analytics/get-merchant-analytics.query";
import { GetMerchantDashboardQuery } from "../../application/queries/get-merchant-dashboard/get-merchant-dashboard.query";
import { ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION, ANALYTICS_EXPORT_OPERATION_DESCRIPTION } from "./analytics-api-docs";
import { AnalyticsExportRateLimitGuard } from "./analytics-export-rate-limit.guard";
import { sendReportFile } from "./report-file.reply";

/**
 * An integration API key's own analytics (D6): the key names no tenant — its tenant and store come from
 * the key, so the path carries no `:tenantSlug`. The same reports as `/tenants/:tenantSlug/analytics`
 * (signed-in members), limited to the key's store scope; a user here has no tenant and gets 401.
 */
@ApiTags("Integration")
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/integration/analytics"))
export class IntegrationAnalyticsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "The API key's tenant reward performance analytics" })
	@ZodResponse(MerchantAnalyticsResponseSchema, { description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodQuery(RewardsAnalyticsQuerySchema) query: z.output<typeof RewardsAnalyticsQuerySchema>,
	): Promise<MerchantAnalyticsResponse> {
		return this.queryBus.execute(new GetMerchantAnalyticsQuery(actor, { tenantId: merchant.tenantId, query }));
	}

	@SkipAuthThrottle()
	@Get("dashboard")
	@ApiOperation({ summary: "The API key's tenant analytics dashboard", description: ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION })
	@ZodResponse(MerchantAnalyticsDashboardSchema, { description: "Merchant analytics dashboard" })
	public getDashboard(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodQuery(MerchantAnalyticsDashboardQuerySchema) query: z.output<typeof MerchantAnalyticsDashboardQuerySchema>,
	): Promise<MerchantAnalyticsDashboard> {
		return this.queryBus.execute(new GetMerchantDashboardQuery(actor, { tenantId: merchant.tenantId, query }));
	}

	@SkipAuthThrottle()
	@UseGuards(AnalyticsExportRateLimitGuard)
	@Get("export")
	@ApiOperation({ summary: "Download the API key's tenant analytics report (csv | xlsx | pdf)", description: ANALYTICS_EXPORT_OPERATION_DESCRIPTION })
	@ZodFileResponse(apiContract.integration.analyticsExport.response, { description: "The report file (Content-Disposition: attachment)" })
	public async exportReport(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodQuery(MerchantAnalyticsExportQuerySchema) query: z.output<typeof MerchantAnalyticsExportQuerySchema>,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendReportFile(reply, await this.queryBus.execute(new ExportMerchantReportQuery(actor, { tenantId: merchant.tenantId, query, request })));
	}
}
