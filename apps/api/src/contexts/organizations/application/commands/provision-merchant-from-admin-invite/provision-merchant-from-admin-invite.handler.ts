import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { Organization } from "../../../domain/aggregates/organization.aggregate";
import { ONBOARDING_INVITE_TTL_DAYS } from "../../../domain/policies/invitation-validity.policy";
import { auditActorId } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { ProvisionMerchantFromAdminInviteCommand, type MerchantInviteCreated } from "./provision-merchant-from-admin-invite.command";

/**
 * The organization (slug derived from the business name), its merchant
 * profile (the category is left for the merchant to state at onboarding), the
 * OWNER onboarding invite, default tenant policies, the audit row and the
 * email request, in one unit of work. The invite URL carries a live token: it
 * leaves the process only inside the email.
 */
@CommandHandler(ProvisionMerchantFromAdminInviteCommand)
export class ProvisionMerchantFromAdminInviteHandler implements ICommandHandler<ProvisionMerchantFromAdminInviteCommand, MerchantInviteCreated> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ProvisionMerchantFromAdminInviteCommand): Promise<MerchantInviteCreated> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const token = this.tokens.issue();

		return this.uow.runSystemOperation("organization.provision.admin_merchant_invite", actor, async (scope): Promise<MerchantInviteCreated> => {
			const now = this.clock.now();
			const organization = Organization.provision(
				scope.organizations.nextId(),
				await scope.organizations.allocateSlug(input.businessName),
				input.businessName,
				{ category: null, city: input.city, contactEmail: input.email },
				adminUserId,
				"Platform admin invite created",
				now,
			);
			await scope.organizations.add(organization);
			const invite = Invitation.issueOnboardingInvite(scope.invitations.nextId(), organization.id, input.email, "OWNER", token.tokenHash, adminUserId, now);
			await scope.invitations.add(invite);
			await scope.tenantPolicies.seedDefaultPolicies(organization.id, adminUserId);
			await scope.audit.record({
				organizationId: organization.id,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(organization.id),
				action: "organization.provisioned",
				resourceType: "Organization",
				resourceId: organization.id,
				metadata: { source: "admin_merchant_invite", inviteId: invite.id },
			});
			await scope.emails.sendMerchantInvite({
				invitationId: invite.id,
				to: input.email,
				businessName: input.businessName,
				city: input.city,
				rawToken: token.rawToken,
				expiresInDays: ONBOARDING_INVITE_TTL_DAYS,
			});
			scope.events.collectFrom(organization);
			scope.events.collectFrom(invite);
			return { inviteId: invite.id, inviteToken: token.rawToken, expiresAt: invite.expiresAt };
		});
	}
}
