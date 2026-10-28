import { Command } from "@nestjs/cqrs";
import type { OpsServerCredentials, RegisterOpsServerInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/operations/servers` (SuperAdmin): register a server and issue its agent token. */
export class RegisterOpsServerCommand extends Command<OpsServerCredentials> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RegisterOpsServerInput,
	) {
		super();
	}
}
