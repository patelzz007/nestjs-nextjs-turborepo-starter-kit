import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_ADMIN_REINSTATE_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { auditActorId, notFound } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { ReinstateTenantCommand } from "./reinstate-tenant.command";

/**
 * SUSPENDED → ACTIVE, and the tenant's PENDING appeal (locked first) accepted with the admin's
 * reason as its answer — state, lifecycle event, appeal review and audit row in one transaction.
 * Authorization: the route's `REACTIVATE MERCHANT_ORG` permission.
 */
@CommandHandler(ReinstateTenantCommand)
export class ReinstateTenantHandler implements ICommandHandler<ReinstateTenantCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "appeals" | "audit" | "events">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReinstateTenantCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		await this.uow.runSystemOperation(TENANT_LIFECYCLE_ADMIN_REINSTATE_OPERATION, actor, async (scope): Promise<void> => {
			const tenant = await scope.tenants.findById(input.tenantId);
			if (tenant === null) {
				throw notFound();
			}
			const now = this.clock.now();
			const appeal = await scope.appeals.findPendingForUpdate(tenant.id);
			tenant.reinstate(adminUserId, input.reason, now);
			appeal?.accept(adminUserId, input.reason, now);
			await scope.tenants.save(tenant);
			if (appeal !== null) {
				await scope.appeals.save(appeal);
			}
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				action: "tenant.reinstated",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { from: "SUSPENDED", to: "ACTIVE", reason: input.reason.trim(), acceptedAppealId: appeal?.id ?? null },
			});
			scope.events.collectFrom(tenant);
		});
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
