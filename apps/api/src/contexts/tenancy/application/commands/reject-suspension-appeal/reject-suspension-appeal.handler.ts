import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantLifecycleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_ADMIN_REJECT_APPEAL_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { auditActorId, notFound } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { RejectSuspensionAppealCommand } from "./reject-suspension-appeal.command";

/** The appeal (locked) PENDING → REJECTED with the admin's note, compare-and-set, audited. Authorization: `MANAGE MERCHANT_ORG`. */
@CommandHandler(RejectSuspensionAppealCommand)
export class RejectSuspensionAppealHandler implements ICommandHandler<RejectSuspensionAppealCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "appeals" | "audit" | "tenantPolicies">>,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RejectSuspensionAppealCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		await this.uow.runSystemOperation(TENANT_LIFECYCLE_ADMIN_REJECT_APPEAL_OPERATION, actor, async (scope): Promise<void> => {
			const appeal = await scope.appeals.findForUpdate(input.tenantId, input.appealId);
			if (appeal === null) {
				throw notFound();
			}
			appeal.reject(adminUserId, input.note, this.clock.now());
			await scope.appeals.save(appeal);
			await scope.audit.record({
				tenantId: input.tenantId,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(input.tenantId),
				action: "tenant.suspension_appeal.rejected",
				resourceType: "TenantSuspensionAppeal",
				resourceId: appeal.id,
				metadata: { note: input.note.trim() },
			});
		});
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
