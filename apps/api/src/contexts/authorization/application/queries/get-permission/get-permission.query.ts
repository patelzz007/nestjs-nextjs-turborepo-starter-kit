import { Query } from "@nestjs/cqrs";
import type { AdminPermissionResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One live permission (404 when no live permission has that id). */
export class GetPermissionQuery extends Query<AdminPermissionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly permissionId: string,
	) {
		super();
	}
}
