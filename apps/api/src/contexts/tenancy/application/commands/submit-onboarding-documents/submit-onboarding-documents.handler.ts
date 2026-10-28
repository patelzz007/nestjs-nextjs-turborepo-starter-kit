import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OnboardingDocumentsClosedError } from "../../../domain/errors/tenants.errors";
import { merchantNotFound } from "../../kyb-errors";
import { resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { TENANT_INVITATION_SUBMIT_ONBOARDING_DOCUMENTS_OPERATION, INVITE_TOKENS, KYB_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
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
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SubmitOnboardingDocumentsCommand): Promise<OnboardingDocumentsSubmitted> {
		const { actor, input } = command;
		const tokenHash = this.tokens.hash(input.token);
		const window = await resolveDocumentsWindowInvite(this.kyb, tokenHash, this.clock.now());

		await this.uow.runSystemOperation(TENANT_INVITATION_SUBMIT_ONBOARDING_DOCUMENTS_OPERATION, actor, async (scope): Promise<void> => {
			const invite = await scope.invitations.findAcceptedOnboardingInviteByTokenHash(tokenHash);
			if (invite === null) {
				throw new OnboardingDocumentsClosedError();
			}
			const now = this.clock.now();
			invite.consumeDocumentsWindow(now);
			await scope.invitations.save(invite);
			const verification = await scope.merchantVerifications.getForUpdate(window.tenantId);
			if (verification === null) {
				throw merchantNotFound();
			}
			verification.submitOnboardingEvidence(input.documentFileIds, await scope.kybFiles.describe(input.documentFileIds), now);
			await scope.merchantVerifications.save(verification);
			await scope.audit.record({
				tenantId: window.tenantId,
				actorUserId: window.acceptedByUserId,
				action: "merchant.kyb_submitted",
				resourceType: "TenantMerchantProfile",
				resourceId: window.tenantId,
				metadata: { inviteId: invite.id, source: "onboarding" },
			});
			scope.events.collectFrom(verification);
		});
		return { success: true };
	}
}
