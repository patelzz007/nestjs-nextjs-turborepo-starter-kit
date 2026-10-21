import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantTenantResponse, PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAdminReadPort } from "../../ports/merchant-admin-read.port";
import { MERCHANT_ADMIN_READ } from "../../ports/tenants.tokens";
import { ListMerchantsQuery } from "./list-merchants.query";

/** Authorization: the route's `LIST MERCHANT_ORG` permission. One page, owners joined in the same query (no N+1). */
@QueryHandler(ListMerchantsQuery)
export class ListMerchantsHandler implements IQueryHandler<ListMerchantsQuery, PaginatedServiceResult<MerchantTenantResponse>> {
	public constructor(@Inject(MERCHANT_ADMIN_READ) private readonly reads: MerchantAdminReadPort) {}

	public async execute(query: ListMerchantsQuery): Promise<PaginatedServiceResult<MerchantTenantResponse>> {
		return this.reads.listMerchants(query.actor, query.input);
	}
}
