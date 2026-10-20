import { Query } from "@nestjs/cqrs";
import type { CheckPermissionResponse, PermissionAction, PermissionResource } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CheckPermissionInput {
	readonly userId: string;
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}

/** Whether a user holds a permission, and which grants satisfy it (admin inspector). */
export class CheckPermissionQuery extends Query<CheckPermissionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CheckPermissionInput,
	) {
		super();
	}
}
