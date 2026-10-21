import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { buildMerchantSubmittedKybFields, MERCHANT_CAPABILITY, type MerchantKybProfileResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { merchantNotFound } from "../../kyb-errors";
import { actingInTenant, requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { KybReadPort } from "../../ports/kyb-read.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { KYB_READ, MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { SubmitKybCommand } from "./submit-kyb.command";

/**
 * Needs `merchant:manage_verification`. The merchant profile row is locked,
 * the details, evidence, review status and the tenant audit row commit
 * in ONE transaction (D06): a failure anywhere leaves no audit row behind.
 */
@CommandHandler(SubmitKybCommand)
export class SubmitKybHandler implements ICommandHandler<SubmitKybCommand, MerchantKybProfileResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SubmitKybCommand): Promise<MerchantKybProfileResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageVerification });
		const tenantActor = actingInTenant(user, member.tenantId);

		await this.uow.run(tenantActor, async (scope): Promise<void> => {
			const verification = await scope.merchantVerifications.getForUpdate(member.tenantId);
			if (verification === null) {
				throw merchantNotFound();
			}
			const previousStatus = verification.currentStatus;
			const evidence = await scope.kybFiles.describe(input.documentFileIds);
			verification.submit(
				{
					legalName: input.legalName.trim(),
					addressText: input.addressText.trim(),
					contactPhone: input.contactPhone.trim(),
					kybFields: buildMerchantSubmittedKybFields(input),
					category: null,
				},
				input.documentFileIds,
				evidence,
				this.clock.now(),
			);
			await scope.merchantVerifications.save(verification);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "merchant.kyb_submitted",
				resourceType: "TenantMerchantProfile",
				resourceId: member.tenantId,
				metadata: { previousStatus, status: verification.currentStatus },
			});
			scope.events.collectFrom(verification);
		});

		const profile = await this.kyb.getProfile(tenantActor, member.tenantId);
		if (profile === null) {
			throw merchantNotFound();
		}
		return profile;
	}
}
