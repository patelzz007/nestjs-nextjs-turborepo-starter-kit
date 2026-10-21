import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, SupportAccessGrantDetail, SupportAccessGrantListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A platform SuperAdmin lists every support access grant. */
export class ListSupportAccessGrantsQuery extends Query<PaginatedServiceResult<SupportAccessGrantDetail>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SupportAccessGrantListQuery,
	) {
		super();
	}
}
