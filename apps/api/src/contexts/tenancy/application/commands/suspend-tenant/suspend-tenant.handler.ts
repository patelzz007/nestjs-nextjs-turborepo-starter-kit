import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_ADMIN_SUSPEND_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { auditActorId, notFound } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { SuspendTenantCommand } from "./suspend-tenant.command";

/**
 * ACTIVE/RESTRICTED → SUSPENDED: compare-and-set on the loaded state, the lifecycle event and the
 * tenant audit row in one transaction. From then on only the tenant's lifecycle routes work (C1).
 * Authorization: the route's `MANAGE MERCHANT_ORG` permission.
 */
@CommandHandler(SuspendTenantCommand)
export class SuspendTenantHandler implements ICommandHandler<SuspendTenantCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "audit" | "tenantPolicies" | "events">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SuspendTenantCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		await this.uow.runSystemOperation(TENANT_LIFECYCLE_ADMIN_SUSPEND_OPERATION, actor, async (scope): Promise<void> => {
			const tenant = await scope.tenants.findById(input.tenantId);
			if (tenant === null) {
				throw notFound();
			}
			const from = tenant.lifecycleState;
			tenant.suspend(adminUserId, input.reason, this.clock.now());
			await scope.tenants.save(tenant);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(tenant.id),
				action: "tenant.suspended",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { from, to: "SUSPENDED", reason: input.reason.trim() },
			});
			scope.events.collectFrom(tenant);
		});
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
