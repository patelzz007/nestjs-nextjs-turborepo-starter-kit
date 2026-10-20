import { Query } from "@nestjs/cqrs";
import type { RoleAssignmentValidationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface RoleAssignmentProposal {
	readonly userId: string;
	readonly roleIds: readonly string[];
}

/** Dry run: would adding `roleIds` to the user's current roles violate a separation-of-duty rule? */
export class ValidateRoleAssignmentQuery extends Query<RoleAssignmentValidationResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly proposal: RoleAssignmentProposal,
	) {
		super();
	}
}
