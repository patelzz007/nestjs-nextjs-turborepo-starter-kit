import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminOrganizationInviteCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { Organization } from "../../../domain/aggregates/organization.aggregate";
import { auditActorId } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { ProvisionOrganizationFromPlatformInviteCommand } from "./provision-organization-from-platform-invite.command";

/**
 * The organization (PROVISIONING, no location yet), its merchant profile,
 * placement, default tenant policies, onboarding invite and audit
 * row in one transaction. Each call mints a new token that exists only in the
 * response; a duplicate slug is 409. Retries are safe through `Idempotency-Key` (D24).
 */
@CommandHandler(ProvisionOrganizationFromPlatformInviteCommand)
export class ProvisionOrganizationFromPlatformInviteHandler implements ICommandHandler<
	ProvisionOrganizationFromPlatformInviteCommand,
	AdminOrganizationInviteCreatedResponse
> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ProvisionOrganizationFromPlatformInviteCommand): Promise<AdminOrganizationInviteCreatedResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const token = this.tokens.issue();

		return this.uow.runSystemOperation("organization.provision.platform_invite", actor, async (scope): Promise<AdminOrganizationInviteCreatedResponse> => {
			const now = this.clock.now();
			const organization = Organization.provision(
				scope.organizations.nextId(),
				input.slug,
				input.displayName,
				{ category: input.category, city: input.city, contactEmail: input.email },
				adminUserId,
				"Platform invite created",
				now,
			);
			await scope.organizations.add(organization);
			const invite = Invitation.issueOnboardingInvite(scope.invitations.nextId(), organization.id, input.email, input.intendedRole, token.tokenHash, adminUserId, now);
			await scope.invitations.add(invite);
			await scope.tenantPolicies.seedDefaultPolicies(organization.id, adminUserId);
			await scope.audit.record({
				organizationId: organization.id,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(organization.id),
				action: "organization.provisioned",
				resourceType: "Organization",
				resourceId: organization.id,
				metadata: { source: "platform_invite", inviteId: invite.id, intendedRole: input.intendedRole },
			});
			scope.events.collectFrom(organization);
			scope.events.collectFrom(invite);
			return { organizationId: organization.id, inviteToken: token.rawToken };
		});
	}
}
