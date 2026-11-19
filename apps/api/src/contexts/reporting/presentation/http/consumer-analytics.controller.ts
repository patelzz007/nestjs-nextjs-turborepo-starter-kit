import { Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	CustomerAnalyticsDashboardSchema,
	UserRewardsAnalyticsResponseSchema,
	type CustomerAnalyticsDashboard,
	type UserRewardsAnalyticsResponse,
} from "@workspace/shared";
import type { z } from "zod";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AnalyticsDashboardAssembler } from "../../application/assemblers/analytics-dashboard.assembler";
import { WeeklyAnalyticsAssembler } from "../../application/assemblers/weekly-analytics.assembler";
import { ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION } from "./analytics-api-docs";

/** The signed-in customer's own analytics under `/claims` (static `analytics` segments win over `:claimId`). */
@ApiTags("Claims")
@ApiBearerAuth()
@ApiController("/claims")
export class ConsumerAnalyticsController {
	public constructor(
		private readonly weekly: WeeklyAnalyticsAssembler,
		private readonly dashboards: AnalyticsDashboardAssembler,
	) {}

	@Get("analytics")
	@ApiOperation({ summary: "Reward activity analytics for the signed-in user" })
	@ZodResponse(UserRewardsAnalyticsResponseSchema, { description: "Claims, redemptions, and referral metrics" })
	public getAnalytics(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.claims.analytics.input) query: z.output<typeof apiContract.claims.analytics.input>,
	): Promise<UserRewardsAnalyticsResponse> {
		return this.weekly.customerAnalytics(actor, query);
	}

	/** Self only: the user id comes from the access token, never from the request. */
	@Get("analytics/dashboard")
	@ApiOperation({
		summary: "My analytics dashboard: custom range + interval, compared totals, series, spending by category / merchant over time",
		description: ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION,
	})
	@ZodResponse(CustomerAnalyticsDashboardSchema, { description: "Customer analytics dashboard" })
	public getAnalyticsDashboard(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.claims.analyticsDashboard.input) query: z.output<typeof apiContract.claims.analyticsDashboard.input>,
	): Promise<CustomerAnalyticsDashboard> {
		return this.dashboards.customerDashboard(actor, query);
	}
}
