import { Command } from "@nestjs/cqrs";
import type { OpsServerCredentials } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/operations/servers/:serverId/token` (SuperAdmin): a new agent token; the old one stops working. */
export class RotateOpsServerTokenCommand extends Command<OpsServerCredentials> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly serverId: string,
	) {
		super();
	}
}
