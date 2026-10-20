import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantAnalyticsResponse } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { authorizeMerchantAnalytics } from "../../assemblers/merchant-analytics-access";
import { REPORTING_MERCHANT_ACCESS } from "../../ports/reporting.tokens";
import { WeeklyAnalyticsAssembler } from "../../assemblers/weekly-analytics.assembler";
import { GetMerchantAnalyticsQuery } from "./get-merchant-analytics.query";

@Injectable()
@QueryHandler(GetMerchantAnalyticsQuery)
export class GetMerchantAnalyticsHandler implements IQueryHandler<GetMerchantAnalyticsQuery, MerchantAnalyticsResponse> {
	public constructor(
		@Inject(REPORTING_MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		private readonly weekly: WeeklyAnalyticsAssembler,
	) {}

	public async execute(query: GetMerchantAnalyticsQuery): Promise<MerchantAnalyticsResponse> {
		const { actor, input } = query;
		const scope = await authorizeMerchantAnalytics(this.merchantAccess, actor, { tenantId: input.tenantId, locationId: input.query.locationId });
		return this.weekly.merchantAnalytics(input.tenantId, scope, input.query);
	}
}
