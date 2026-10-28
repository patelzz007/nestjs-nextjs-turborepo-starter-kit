import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantMembershipLeaveResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { TENANT_MEMBERSHIP_LEAVE_OPERATION, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { notFound, requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { LeaveTenantCommand } from "./leave-tenant.command";

/**
 * The leave-tenant route: the one tenant route a suspended or pending membership may call (C1), so
 * the membership is the caller's own live row in any status, read under its row lock. It and its
 * location scope rows are soft-deleted with the audit row in one transaction; the owner is refused.
 */
@CommandHandler(LeaveTenantCommand)
export class LeaveTenantHandler implements ICommandHandler<LeaveTenantCommand, TenantMembershipLeaveResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "memberships" | "audit" | "events">>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: LeaveTenantCommand): Promise<TenantMembershipLeaveResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		return this.uow.runSystemOperation(TENANT_MEMBERSHIP_LEAVE_OPERATION, actor, async (scope): Promise<TenantMembershipLeaveResponse> => {
			const tenant = await scope.tenants.findByRouteKey(input.tenantSlug);
			const membership = tenant === null ? null : await scope.memberships.getOwnLiveForUpdate(tenant.id, user.userId);
			if (tenant === null || membership === null) {
				throw notFound();
			}
			const leftAt = this.clock.now();
			membership.leave(leftAt);
			await scope.memberships.save(membership);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: user.userId,
				action: "membership.left",
				resourceType: "Membership",
				resourceId: membership.id,
				metadata: { role: membership.role, status: membership.status },
			});
			scope.events.collectFrom(membership);
			return { tenantId: tenant.id, membershipId: membership.id, leftAt };
		});
	}
}
