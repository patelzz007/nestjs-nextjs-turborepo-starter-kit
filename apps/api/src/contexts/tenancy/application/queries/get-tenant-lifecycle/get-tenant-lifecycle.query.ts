import { Query } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A member reads their tenant's lifecycle (also while it is suspended or pending deletion). */
export class GetTenantLifecycleQuery extends Query<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string },
	) {
		super();
	}
}
