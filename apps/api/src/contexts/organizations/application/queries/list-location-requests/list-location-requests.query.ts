import { Query } from "@nestjs/cqrs";
import type { AdminLocationRequestListQuery, AdminLocationRequestResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The admin queue of store requests (live, non-primary locations). */
export class ListLocationRequestsQuery extends Query<PaginatedServiceResult<AdminLocationRequestResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminLocationRequestListQuery,
	) {
		super();
	}
}
