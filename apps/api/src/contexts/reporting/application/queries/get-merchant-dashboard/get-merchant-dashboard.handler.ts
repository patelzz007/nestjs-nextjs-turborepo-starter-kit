import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantAnalyticsDashboard } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { authorizeMerchantAnalytics } from "../../assemblers/merchant-analytics-access";
import { REPORTING_MERCHANT_ACCESS } from "../../ports/reporting.tokens";
import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { GetMerchantDashboardQuery } from "./get-merchant-dashboard.query";

@Injectable()
@QueryHandler(GetMerchantDashboardQuery)
export class GetMerchantDashboardHandler implements IQueryHandler<GetMerchantDashboardQuery, MerchantAnalyticsDashboard> {
	public constructor(
		@Inject(REPORTING_MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		private readonly dashboards: AnalyticsDashboardAssembler,
	) {}

	public async execute(query: GetMerchantDashboardQuery): Promise<MerchantAnalyticsDashboard> {
		const { actor, input } = query;
		// Never "no filter": a store-limited member (or store-scoped key) sees only its stores.
		const scope = await authorizeMerchantAnalytics(this.merchantAccess, actor, { organizationId: input.organizationId, locationId: input.query.locationId });
		const { dashboard } = await this.dashboards.merchantDashboard(input.organizationId, scope, input.query);
		return dashboard;
	}
}
