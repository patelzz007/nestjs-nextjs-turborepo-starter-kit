import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantOrgResponse, PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAdminReadPort } from "../../ports/merchant-admin-read.port";
import { MERCHANT_ADMIN_READ } from "../../ports/tenants.tokens";
import { ListMerchantsQuery } from "./list-merchants.query";

/** Authorization: the route's `LIST MERCHANT_ORG` permission. One page, owners joined in the same query (no N+1). */
@QueryHandler(ListMerchantsQuery)
export class ListMerchantsHandler implements IQueryHandler<ListMerchantsQuery, PaginatedServiceResult<MerchantOrgResponse>> {
	public constructor(@Inject(MERCHANT_ADMIN_READ) private readonly reads: MerchantAdminReadPort) {}

	public async execute(query: ListMerchantsQuery): Promise<PaginatedServiceResult<MerchantOrgResponse>> {
		return this.reads.listMerchants(query.actor, query.input);
	}
}
