import { Query } from "@nestjs/cqrs";
import type { PermissionGroupsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Distinct, non-empty groups of the live permissions. */
export class ListPermissionGroupsQuery extends Query<PermissionGroupsResponse> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
