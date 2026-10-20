import { Command } from "@nestjs/cqrs";
import type { MerchantCreateTerminalInput, MerchantTerminalPairing } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /tenants/:tenantSlug/terminals`: register a till at one store and issue its first pairing code. */
export class RegisterTerminalCommand extends Command<MerchantTerminalPairing> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantCreateTerminalInput & { readonly tenantId: string },
	) {
		super();
	}
}
