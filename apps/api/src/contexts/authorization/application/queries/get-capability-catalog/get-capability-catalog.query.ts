import { Query } from "@nestjs/cqrs";
import type { CapabilityCatalogResponse, CapabilityScope } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Capability catalog entries, optionally of one scope. */
export class GetCapabilityCatalogQuery extends Query<CapabilityCatalogResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly scope: CapabilityScope | undefined,
	) {
		super();
	}
}
