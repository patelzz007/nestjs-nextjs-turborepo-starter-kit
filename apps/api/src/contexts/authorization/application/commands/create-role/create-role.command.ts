import { Command } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CreateRoleInput {
	readonly name: string;
	readonly description?: string | undefined;
}

/** Create a (never system) role, flat and without permissions; they are added with a sync. */
export class CreateRoleCommand extends Command<RoleResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateRoleInput,
	) {
		super();
	}
}
