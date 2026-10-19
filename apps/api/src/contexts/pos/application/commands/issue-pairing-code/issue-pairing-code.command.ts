import { Command } from "@nestjs/cqrs";
import type { MerchantTerminalPairing } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /orgs/:orgSlug/terminals/:id/pairing-code`: a new code for a first pairing, an expired code, or a re-pair. */
export class IssuePairingCodeCommand extends Command<MerchantTerminalPairing> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly organizationId: string; readonly terminalRowId: string },
	) {
		super();
	}
}
