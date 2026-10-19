import { Query } from "@nestjs/cqrs";
import type { MerchantTerminalStatusSummary, MerchantTerminalStatusSummaryQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/terminals/summary`. */
export class GetTerminalSummaryQuery extends Query<MerchantTerminalStatusSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantTerminalStatusSummaryQuery & { readonly organizationId: string },
	) {
		super();
	}
}
