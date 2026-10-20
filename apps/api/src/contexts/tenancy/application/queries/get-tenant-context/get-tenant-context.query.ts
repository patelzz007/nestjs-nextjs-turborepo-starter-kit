import { Query } from "@nestjs/cqrs";
import type { TenantContextResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The tenant, the caller's membership, its stores and merchant profile (any member). */
export class GetTenantContextQuery extends Query<TenantContextResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string },
	) {
		super();
	}
}
