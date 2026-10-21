import { Query } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A platform admin reads one tenant's lifecycle, suspension and appeals. */
export class GetTenantLifecycleForAdminQuery extends Query<TenantLifecycleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantId: string },
	) {
		super();
	}
}
