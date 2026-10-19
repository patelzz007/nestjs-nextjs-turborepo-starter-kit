import { Query } from "@nestjs/cqrs";
import type { OrganizationContextResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The organization, the caller's membership, its stores and merchant profile (any member). */
export class GetOrganizationContextQuery extends Query<OrganizationContextResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly orgSlug: string },
	) {
		super();
	}
}
