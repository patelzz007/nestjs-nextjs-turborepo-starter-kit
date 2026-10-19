import { Query } from "@nestjs/cqrs";
import type { MerchantTerminalListQuery, MerchantTerminalSummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/terminals`. */
export class ListTerminalsQuery extends Query<PaginatedServiceResult<MerchantTerminalSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantTerminalListQuery & { readonly organizationId: string },
	) {
		super();
	}
}
