import { Command } from "@nestjs/cqrs";
import type { OkResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /tenants/:tenantSlug/terminals/:id`: remove a till and revoke its key. */
export class RemoveTerminalCommand extends Command<OkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantId: string; readonly terminalRowId: string },
	) {
		super();
	}
}
