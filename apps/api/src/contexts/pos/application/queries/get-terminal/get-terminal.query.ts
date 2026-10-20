import { Query } from "@nestjs/cqrs";
import type { MerchantTerminalSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/terminals/:id`. */
export class GetTerminalQuery extends Query<MerchantTerminalSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantId: string; readonly terminalRowId: string },
	) {
		super();
	}
}
