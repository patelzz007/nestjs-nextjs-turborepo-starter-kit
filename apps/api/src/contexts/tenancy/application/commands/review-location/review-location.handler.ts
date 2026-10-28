import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { LocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { auditActorId } from "../../tenant-actor";
import { toLocationResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import { TENANTS_UNIT_OF_WORK, LOCATION_ADMIN_REVIEW_OPERATION } from "../../ports/tenants.tokens";
import { ReviewLocationCommand } from "./review-location.command";

/** PENDING_APPROVAL → ACTIVE / REJECTED as a compare-and-set: a concurrent review wins, the loser gets 409. */
@CommandHandler(ReviewLocationCommand)
export class ReviewLocationHandler implements ICommandHandler<ReviewLocationCommand, LocationResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviewLocationCommand): Promise<LocationResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);

		return this.uow.runSystemOperation(LOCATION_ADMIN_REVIEW_OPERATION, actor, async (scope): Promise<LocationResponse> => {
			const location = await scope.locations.findLive(input.tenantId, input.locationId);
			if (location === null) {
				throw new NotFoundError();
			}
			location.review(input.approve, input.approve ? null : (input.rejectionReason?.trim() ?? null), adminUserId, this.clock.now());
			const stored = await scope.locations.save(location);
			await scope.audit.record({
				tenantId: input.tenantId,
				actorUserId: adminUserId,
				action: input.approve ? "tenant.location.approved" : "tenant.location.rejected",
				resourceType: "Location",
				resourceId: stored.id,
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
