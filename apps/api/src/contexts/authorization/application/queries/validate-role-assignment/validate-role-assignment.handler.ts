import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RoleAssignmentValidationResponse } from "@workspace/shared";

import { assertSeparationOfDuties } from "../../../domain/policies/separation-of-duties.policy";
import { RBAC_INSPECTION_READ } from "../../ports/authorization.tokens";
import type { RbacInspectionReader, RbacInspectionReadPort } from "../../ports/rbac-read.port";
import { ValidateRoleAssignmentQuery } from "./validate-role-assignment.query";

/** A violation answers 409 with the rule; a clean set answers `valid: true`. Nothing is written. */
@QueryHandler(ValidateRoleAssignmentQuery)
export class ValidateRoleAssignmentHandler implements IQueryHandler<ValidateRoleAssignmentQuery, RoleAssignmentValidationResponse> {
	public constructor(@Inject(RBAC_INSPECTION_READ) private readonly inspection: RbacInspectionReadPort) {}

	public async execute(query: ValidateRoleAssignmentQuery): Promise<RoleAssignmentValidationResponse> {
		const { userId, roleIds } = query.proposal;
		await this.inspection.inspect(query.actor, "Validate a proposed role assignment against separation-of-duty rules", async (reader: RbacInspectionReader): Promise<void> => {
			const current: string[] = await reader.assignedRoleIds(userId);
			assertSeparationOfDuties(await reader.activeRoleNames([...current, ...roleIds]));
		});
		return { valid: true, message: "No conflicts detected" };
	}
}
