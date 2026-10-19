import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminLocationRequestResponse, PaginatedServiceResult } from "@workspace/shared";

import type { MerchantAdminReadPort } from "../../ports/merchant-admin-read.port";
import { MERCHANT_ADMIN_READ } from "../../ports/organizations.tokens";
import { ListLocationRequestsQuery } from "./list-location-requests.query";

/** Authorization: the route's `LIST MERCHANT_ORG` permission (platform admins). */
@QueryHandler(ListLocationRequestsQuery)
export class ListLocationRequestsHandler implements IQueryHandler<ListLocationRequestsQuery, PaginatedServiceResult<AdminLocationRequestResponse>> {
	public constructor(@Inject(MERCHANT_ADMIN_READ) private readonly reads: MerchantAdminReadPort) {}

	public async execute(query: ListLocationRequestsQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		return this.reads.listLocationRequests(query.actor, query.input);
	}
}
