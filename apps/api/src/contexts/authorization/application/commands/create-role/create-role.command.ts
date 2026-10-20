import { Command } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CreateRoleInput {
	readonly name: string;
	readonly description?: string | undefined;
	readonly parentId?: string | undefined;
}

/** Create a (never system) role. A parent's permissions must be within the actor's reach. */
export class CreateRoleCommand extends Command<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateRoleInput,
	) {
		super();
	}
}
