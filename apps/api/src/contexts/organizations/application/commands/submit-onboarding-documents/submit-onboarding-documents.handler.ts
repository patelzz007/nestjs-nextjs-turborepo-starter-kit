import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OnboardingDocumentsClosedError } from "../../../domain/errors/organizations.errors";
import { merchantNotFound } from "../../kyb-errors";
import { resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_READ, ORGANIZATIONS_UNIT_OF_WORK, TENANT_POLICY } from "../../ports/organizations.tokens";
import type { TenantPolicyPort } from "../../ports/tenant-policy.port";
import { SubmitOnboardingDocumentsCommand, type OnboardingDocumentsSubmitted } from "./submit-onboarding-documents.command";

/**
 * One transaction: the document window is consumed (compare-and-set, so a
 * replayed or concurrent submission finds it closed), the evidence replaced
 * under the merchant profile's lock and the audit row written. A decided
 * review (APPROVED or REJECTED) is final.
 */
@CommandHandler(SubmitOnboardingDocumentsCommand)
export class SubmitOnboardingDocumentsHandler implements ICommandHandler<SubmitOnboardingDocumentsCommand, OnboardingDocumentsSubmitted> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(TENANT_POLICY) private readonly tenantPolicy: TenantPolicyPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SubmitOnboardingDocumentsCommand): Promise<OnboardingDocumentsSubmitted> {
		const { actor, input } = command;
		const tokenHash = this.tokens.hash(input.token);
		const window = await resolveDocumentsWindowInvite(this.kyb, tokenHash, this.clock.now());
		const policyVersion = await this.tenantPolicy.activePolicyVersion(window.organizationId);

		await this.uow.runSystemOperation("organization.invitation.submit_onboarding_documents", actor, async (scope): Promise<void> => {
			const invite = await scope.invitations.findAcceptedOnboardingInviteByTokenHash(tokenHash);
			if (invite === null) {
				throw new OnboardingDocumentsClosedError();
			}
			const now = this.clock.now();
			invite.consumeDocumentsWindow(now);
			await scope.invitations.save(invite);
			const verification = await scope.merchantVerifications.getForUpdate(window.organizationId);
			if (verification === null) {
				throw merchantNotFound();
			}
			verification.submitOnboardingEvidence(input.documentFileIds, await scope.kybFiles.describe(input.documentFileIds), now);
			await scope.merchantVerifications.save(verification);
			await scope.audit.record({
				organizationId: window.organizationId,
				actorUserId: window.acceptedByUserId,
				policyVersion,
				action: "merchant.kyb_submitted",
				resourceType: "OrganizationMerchantProfile",
				resourceId: window.organizationId,
				metadata: { inviteId: invite.id, source: "onboarding" },
			});
			scope.events.collectFrom(verification);
		});
		return { success: true };
	}
}
