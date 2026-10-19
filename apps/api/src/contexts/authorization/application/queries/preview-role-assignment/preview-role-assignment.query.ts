import { Query } from "@nestjs/cqrs";
import type { RoleAssignmentPreview } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { RoleAssignmentProposal } from "../validate-role-assignment/validate-role-assignment.query";

/** Dry run of "replace this user's roles with `roleIds`": what they would gain and lose. */
export class PreviewRoleAssignmentQuery extends Query<RoleAssignmentPreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly proposal: RoleAssignmentProposal,
	) {
		super();
	}
}
