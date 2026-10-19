import { Query } from "@nestjs/cqrs";
import type { MerchantTerminalSettings } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/terminals/settings`. */
export class GetPosSettingsQuery extends Query<MerchantTerminalSettings> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly organizationId: string },
	) {
		super();
	}
}
