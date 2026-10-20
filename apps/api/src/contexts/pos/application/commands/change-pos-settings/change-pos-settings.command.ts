import { Command } from "@nestjs/cqrs";
import type { MerchantTerminalSettings } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /tenants/:tenantSlug/terminals/settings`: turn "only allow registered terminals" on or off. */
export class ChangePosSettingsCommand extends Command<MerchantTerminalSettings> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantTerminalSettings & { readonly tenantId: string },
	) {
		super();
	}
}
