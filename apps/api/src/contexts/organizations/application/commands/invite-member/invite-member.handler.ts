import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OrganizationMemberInviteCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { TEAM_INVITE_TTL_DAYS } from "../../../domain/policies/invitation-validity.policy";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { INVITE_TOKENS, MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { InviteMemberCommand } from "./invite-member.command";

/** Shown in the invite email when the invitee gets every store. */
const ALL_LOCATIONS_SUMMARY = "All locations";
/** Shown when none of the selected stores could be named (they were closed meanwhile). */
const SELECTED_LOCATIONS_FALLBACK_SUMMARY = "Selected locations";

/**
 * ONE unit of work: the membership and store checks, closing a lapsed invite
 * to the same address, the new invite, its audit rows and the email request.
 * The raw token leaves the API only inside the invite email.
 */
@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler implements ICommandHandler<InviteMemberCommand, OrganizationMemberInviteCreatedResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: InviteMemberCommand): Promise<OrganizationMemberInviteCreatedResponse> {
		const { actor, input } = command;
		const manager = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageTeam });
		const granted = LocationScope.of(input.locationScopeType, input.locationIds);
		LocationScope.of(grant.locationScope, grant.locationIds).assertCanGrant(granted);
		const token = this.tokens.issue();
		const { organizationId } = member;

		return this.uow.runSystemOperation("organization.invitation.create", actor, async (scope): Promise<OrganizationMemberInviteCreatedResponse> => {
			const now = this.clock.now();
			const inviteeUserId = await scope.accounts.findAccountIdByEmail(input.email);
			const invite = Invitation.issueTeamInvite(
				scope.invitations.nextId(),
				organizationId,
				input.email,
				input.role,
				granted,
				{
					inviteeIsMember: inviteeUserId !== null && (await scope.memberships.existsLive(organizationId, inviteeUserId)),
					activeLocationCount: await scope.locations.countActiveAmong(organizationId, granted.locationIds),
				},
				token.tokenHash,
				manager.userId,
				now,
			);
			const auditBase = { organizationId, actorUserId: manager.userId, policyVersion: member.policyVersion, resourceType: "OrganizationInvitation" };

			// A lapsed invitation no longer blocks a fresh one: close it first, so the one-PENDING-per-email index admits the new row.
			const pending = await scope.invitations.findPendingTeamInviteByEmail(organizationId, input.email);
			if (pending !== null) {
				pending.expire(now);
				await scope.invitations.save(pending);
				await scope.audit.record({ ...auditBase, action: "membership.invite_expired", resourceId: pending.id });
				scope.events.collectFrom(pending);
			}

			await scope.invitations.add(invite);
			await scope.audit.record({
				...auditBase,
				action: "membership.invite_sent",
				resourceId: invite.id,
				metadata: { role: input.role, email: input.email, locationScopeType: input.locationScopeType },
			});
			await scope.emails.sendTeamInvite({
				invitationId: invite.id,
				to: input.email,
				organizationName: member.displayName,
				role: input.role,
				locationSummary: await this.locationSummary(scope, organizationId, granted),
				rawToken: token.rawToken,
				expiresInDays: TEAM_INVITE_TTL_DAYS,
			});
			scope.events.collectFrom(invite);
			return { inviteId: invite.id, message: "Invitation sent" };
		});
	}

	private async locationSummary(scope: OrganizationsScope, organizationId: string, granted: LocationScope): Promise<string> {
		if (granted.coversAllLocations) {
			return ALL_LOCATIONS_SUMMARY;
		}
		const names = await scope.locations.activeNamesAmong(organizationId, granted.locationIds);
		return names.length === 0 ? SELECTED_LOCATIONS_FALLBACK_SUMMARY : names.join(", ");
	}
}
