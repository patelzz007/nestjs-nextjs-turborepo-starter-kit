import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, SupportAccessGrantDetail } from "@workspace/shared";

import { SUPPORT_ACCESS_READ } from "../../ports/authorization.tokens";
import type { SupportAccessReadPort } from "../../ports/support-access-read.port";
import { ListSupportAccessGrantsQuery } from "./list-support-access-grants.query";

/** Authorization: the route's SuperAdmin + READ USER checks. */
@QueryHandler(ListSupportAccessGrantsQuery)
export class ListSupportAccessGrantsHandler implements IQueryHandler<ListSupportAccessGrantsQuery, PaginatedServiceResult<SupportAccessGrantDetail>> {
	public constructor(@Inject(SUPPORT_ACCESS_READ) private readonly reads: SupportAccessReadPort) {}

	public execute(query: ListSupportAccessGrantsQuery): Promise<PaginatedServiceResult<SupportAccessGrantDetail>> {
		return this.reads.listForAdmin(query.actor, query.input);
	}
}
