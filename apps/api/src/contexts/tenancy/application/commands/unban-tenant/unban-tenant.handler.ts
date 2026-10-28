import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_ADMIN_UNBAN_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { auditActorId, notFound } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { UnbanTenantCommand } from "./unban-tenant.command";

/**
 * BANNED → ACTIVE: compare-and-set on the loaded state, the lifecycle event and the tenant audit
 * row in one transaction. Authorization: the route's `@SuperAdminOnly()`.
 */
@CommandHandler(UnbanTenantCommand)
export class UnbanTenantHandler implements ICommandHandler<UnbanTenantCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "audit" | "events">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: UnbanTenantCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		await this.uow.runSystemOperation(TENANT_LIFECYCLE_ADMIN_UNBAN_OPERATION, actor, async (scope): Promise<void> => {
			const tenant = await scope.tenants.findById(input.tenantId);
			if (tenant === null) {
				throw notFound();
			}
			tenant.unban(adminUserId, input.reason, this.clock.now());
			await scope.tenants.save(tenant);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				action: "tenant.unbanned",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { from: "BANNED", to: "ACTIVE", reason: input.reason.trim() },
			});
			scope.events.collectFrom(tenant);
		});
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
