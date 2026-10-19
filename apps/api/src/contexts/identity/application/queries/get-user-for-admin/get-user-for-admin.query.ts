import { Query } from "@nestjs/cqrs";
import type { AdminUserDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetUserForAdminInput {
	readonly userId: string;
}

/** SuperAdmin user detail with security state. */
export class GetUserForAdminQuery extends Query<AdminUserDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetUserForAdminInput,
	) {
		super();
	}
}
