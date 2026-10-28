import { Command } from "@nestjs/cqrs";
import type { DeleteSuccessData } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /admin/operations/servers/:serverId` (SuperAdmin): stop monitoring a server; its token stops working. */
export class RevokeOpsServerCommand extends Command<DeleteSuccessData> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly serverId: string,
	) {
		super();
	}
}
