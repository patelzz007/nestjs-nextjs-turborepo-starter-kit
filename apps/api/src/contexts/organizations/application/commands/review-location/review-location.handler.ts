import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OrganizationLocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { auditActorId } from "../../organization-actor";
import { toLocationResponse } from "../../organization-responses";
import type { OrganizationsScope } from "../../organizations-scope";
import { ORGANIZATIONS_UNIT_OF_WORK, TENANT_POLICY } from "../../ports/organizations.tokens";
import type { TenantPolicyPort } from "../../ports/tenant-policy.port";
import { ReviewLocationCommand } from "./review-location.command";

/** PENDING_APPROVAL → ACTIVE / REJECTED as a compare-and-set: a concurrent review wins, the loser gets 409. */
@CommandHandler(ReviewLocationCommand)
export class ReviewLocationHandler implements ICommandHandler<ReviewLocationCommand, OrganizationLocationResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(TENANT_POLICY) private readonly tenantPolicy: TenantPolicyPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviewLocationCommand): Promise<OrganizationLocationResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const policyVersion = await this.tenantPolicy.activePolicyVersion(input.organizationId);

		return this.uow.runSystemOperation("organization.location.admin_review", actor, async (scope): Promise<OrganizationLocationResponse> => {
			const location = await scope.locations.findLive(input.organizationId, input.locationId);
			if (location === null) {
				throw new NotFoundError();
			}
			location.review(input.approve, input.approve ? null : (input.rejectionReason?.trim() ?? null), adminUserId, this.clock.now());
			const stored = await scope.locations.save(location);
			await scope.audit.record({
				organizationId: input.organizationId,
				actorUserId: adminUserId,
				policyVersion,
				action: input.approve ? "organization.location.approved" : "organization.location.rejected",
				resourceType: "OrganizationLocation",
				resourceId: stored.id,
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
