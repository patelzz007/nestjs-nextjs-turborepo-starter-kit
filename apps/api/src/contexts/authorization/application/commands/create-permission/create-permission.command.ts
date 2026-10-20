import { Command } from "@nestjs/cqrs";
import type { AdminPermissionResponse, PermissionAction, PermissionResource } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CreatePermissionInput {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly description?: string | undefined;
	readonly group?: string | undefined;
}

/** Create a (non-system, GLOBAL) catalog permission. */
export class CreatePermissionCommand extends Command<AdminPermissionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreatePermissionInput,
	) {
		super();
	}
}
