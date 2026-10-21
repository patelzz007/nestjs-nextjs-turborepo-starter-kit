import { Query } from "@nestjs/cqrs";
import type { SupportAccessGrantDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A tenant owner lists their tenant's support access grants (to approve the pending ones). */
export class ListTenantSupportAccessGrantsQuery extends Query<readonly SupportAccessGrantDetail[]> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string },
	) {
		super();
	}
}
