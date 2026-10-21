import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantLifecycleResponse } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { SuspensionAppeal } from "../../../domain/aggregates/suspension-appeal.aggregate";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import type { TenantLifecycleReadPort } from "../../ports/tenant-lifecycle-read.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANT_LIFECYCLE_APPEAL_OPERATION, TENANT_LIFECYCLE_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { readLifecycleOrNotFound } from "../../tenant-lifecycle-view";
import { notFound, requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { SubmitSuspensionAppealCommand } from "./submit-suspension-appeal.command";

/**
 * A lifecycle route (it runs while the tenant is suspended). Needs `merchant:manage_verification`
 * (the owner). The tenant must be SUSPENDED; the PENDING appeal and its audit row commit together,
 * and the partial unique index allows one pending appeal per tenant (a second is 409).
 */
@CommandHandler(SubmitSuspensionAppealCommand)
export class SubmitSuspensionAppealHandler implements ICommandHandler<SubmitSuspensionAppealCommand, TenantLifecycleResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "tenants" | "appeals" | "audit">>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort,
	) {}

	public async execute(command: SubmitSuspensionAppealCommand): Promise<TenantLifecycleResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageVerification });

		await this.uow.runSystemOperation(TENANT_LIFECYCLE_APPEAL_OPERATION, actor, async (scope): Promise<void> => {
			const tenant = await scope.tenants.findById(member.tenantId);
			if (tenant === null) {
				throw notFound();
			}
			tenant.assertAppealable();
			const appeal = SuspensionAppeal.submit(scope.appeals.nextId(), tenant.id, user.userId, input.message);
			await scope.appeals.add(appeal);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "tenant.suspension.appealed",
				resourceType: "TenantSuspensionAppeal",
				resourceId: appeal.id,
				metadata: { message: appeal.message },
			});
		});
		return readLifecycleOrNotFound(this.reads, member.tenantId);
	}
}
