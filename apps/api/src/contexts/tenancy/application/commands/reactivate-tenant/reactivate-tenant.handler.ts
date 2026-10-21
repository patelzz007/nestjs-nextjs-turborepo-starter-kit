import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { TenantOwnerRequiredError } from "../../../domain/errors/tenants.errors";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_REACTIVATE_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { notFound, requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { ReactivateTenantCommand } from "./reactivate-tenant.command";

/**
 * A lifecycle route for a tenant pending deletion — which the merchant capability gate does not
 * serve, so the owner check is the caller's own ACTIVE OWNER membership, read under its row lock.
 * PENDING_DELETION → ACTIVE (the grace period must still run): compare-and-set, lifecycle event
 * and audit row in one transaction. Anyone else gets the uniform 404 or 403 `TENANT_OWNER_REQUIRED`.
 */
@CommandHandler(ReactivateTenantCommand)
export class ReactivateTenantHandler implements ICommandHandler<ReactivateTenantCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "memberships" | "audit" | "tenantPolicies" | "events">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReactivateTenantCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const tenantId = await this.uow.runSystemOperation(TENANT_LIFECYCLE_REACTIVATE_OPERATION, actor, async (scope): Promise<string> => {
			const tenant = await scope.tenants.findByRouteKey(input.tenantSlug);
			const membership = tenant === null ? null : await scope.memberships.getOwnActiveForUpdate(tenant.id, user.userId);
			if (tenant === null || membership === null) {
				throw notFound();
			}
			if (membership.role !== "OWNER") {
				throw new TenantOwnerRequiredError();
			}
			tenant.reactivate(user.userId, this.clock.now());
			await scope.tenants.save(tenant);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: user.userId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(tenant.id),
				action: "tenant.reactivated",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { from: "PENDING_DELETION", to: "ACTIVE" },
			});
			scope.events.collectFrom(tenant);
			return tenant.id;
		});
		return readLifecycleOrNotFound(this.reads, tenantId);
	}
}
