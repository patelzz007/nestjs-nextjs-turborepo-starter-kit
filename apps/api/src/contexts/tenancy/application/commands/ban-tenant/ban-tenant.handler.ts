import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_ADMIN_BAN_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { auditActorId, notFound } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { BanTenantCommand } from "./ban-tenant.command";

/** The answer a pending suspension appeal gets when the tenant is banned instead of reinstated. */
export const APPEAL_CLOSED_BY_BAN_NOTE = "Closed: the platform banned this business.";

/**
 * ACTIVE/RESTRICTED/SUSPENDED → BANNED: compare-and-set on the loaded state, the lifecycle event,
 * the tenant's PENDING appeal (locked first) rejected — a banned tenant cannot appeal — and the
 * tenant audit row, in one transaction. From then on only the tenant's lifecycle routes work, and
 * they only read the status or let a member leave. Authorization: the route's `@SuperAdminOnly()`.
 */
@CommandHandler(BanTenantCommand)
export class BanTenantHandler implements ICommandHandler<BanTenantCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "appeals" | "audit" | "events">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: BanTenantCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		await this.uow.runSystemOperation(TENANT_LIFECYCLE_ADMIN_BAN_OPERATION, actor, async (scope): Promise<void> => {
			const tenant = await scope.tenants.findById(input.tenantId);
			if (tenant === null) {
				throw notFound();
			}
			const now = this.clock.now();
			const from = tenant.lifecycleState;
			const appeal = await scope.appeals.findPendingForUpdate(tenant.id);
			tenant.ban(adminUserId, input.reason, now);
			appeal?.reject(adminUserId, APPEAL_CLOSED_BY_BAN_NOTE, now);
			await scope.tenants.save(tenant);
			if (appeal !== null) {
				await scope.appeals.save(appeal);
			}
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				action: "tenant.banned",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { from, to: "BANNED", reason: input.reason.trim(), closedAppealId: appeal?.id ?? null },
			});
			scope.events.collectFrom(tenant);
		});
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
