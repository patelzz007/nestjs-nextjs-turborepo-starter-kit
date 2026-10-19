import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { buildMerchantSubmittedKybFields, MERCHANT_CAPABILITY, type MerchantKybProfileResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { merchantNotFound } from "../../kyb-errors";
import { actingInOrganization, requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { KybReadPort } from "../../ports/kyb-read.port";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { KYB_READ, MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { SubmitKybCommand } from "./submit-kyb.command";

/**
 * Needs `merchant:manage_verification`. The merchant profile row is locked,
 * the details, evidence, review status and the organization audit row commit
 * in ONE transaction (D06): a failure anywhere leaves no audit row behind.
 */
@CommandHandler(SubmitKybCommand)
export class SubmitKybHandler implements ICommandHandler<SubmitKybCommand, MerchantKybProfileResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SubmitKybCommand): Promise<MerchantKybProfileResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageVerification });
		const tenantActor = actingInOrganization(user, member.organizationId);

		await this.uow.run(tenantActor, async (scope): Promise<void> => {
			const verification = await scope.merchantVerifications.getForUpdate(member.organizationId);
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
				organizationId: member.organizationId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "merchant.kyb_submitted",
				resourceType: "OrganizationMerchantProfile",
				resourceId: member.organizationId,
				metadata: { previousStatus, status: verification.currentStatus },
			});
			scope.events.collectFrom(verification);
		});

		const profile = await this.kyb.getProfile(tenantActor, member.organizationId);
		if (profile === null) {
			throw merchantNotFound();
		}
		return profile;
	}
}
