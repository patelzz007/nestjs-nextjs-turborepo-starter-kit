import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantMemberInviteCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { TEAM_INVITE_TTL_DAYS } from "../../../domain/policies/invitation-validity.policy";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { INVITE_TOKENS, MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
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
export class InviteMemberHandler implements ICommandHandler<InviteMemberCommand, TenantMemberInviteCreatedResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: InviteMemberCommand): Promise<TenantMemberInviteCreatedResponse> {
		const { actor, input } = command;
		const manager = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageTeam });
		const granted = LocationScope.of(input.locationScopeType, input.locationIds);
		LocationScope.of(grant.locationScope, grant.locationIds).assertCanGrant(granted);
		const token = this.tokens.issue();
		const { tenantId } = member;

		return this.uow.runSystemOperation("tenant.invitation.create", actor, async (scope): Promise<TenantMemberInviteCreatedResponse> => {
			const now = this.clock.now();
			const inviteeUserId = await scope.accounts.findAccountIdByEmail(input.email);
			const invite = Invitation.issueTeamInvite(
				scope.invitations.nextId(),
				tenantId,
				input.email,
				input.role,
				granted,
				{
					inviteeIsMember: inviteeUserId !== null && (await scope.memberships.existsLive(tenantId, inviteeUserId)),
					activeLocationCount: await scope.locations.countActiveAmong(tenantId, granted.locationIds),
				},
				token.tokenHash,
				manager.userId,
				now,
			);
			const auditBase = { tenantId, actorUserId: manager.userId, policyVersion: member.policyVersion, resourceType: "TenantInvitation" };

			// A lapsed invitation no longer blocks a fresh one: close it first, so the one-PENDING-per-email index admits the new row.
			const pending = await scope.invitations.findPendingTeamInviteByEmail(tenantId, input.email);
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
				tenantName: member.displayName,
				role: input.role,
				locationSummary: await this.locationSummary(scope, tenantId, granted),
				rawToken: token.rawToken,
				expiresInDays: TEAM_INVITE_TTL_DAYS,
			});
			scope.events.collectFrom(invite);
			return { inviteId: invite.id, message: "Invitation sent" };
		});
	}

	private async locationSummary(scope: TenantsScope, tenantId: string, granted: LocationScope): Promise<string> {
		if (granted.coversAllLocations) {
			return ALL_LOCATIONS_SUMMARY;
		}
		const names = await scope.locations.activeNamesAmong(tenantId, granted.locationIds);
		return names.length === 0 ? SELECTED_LOCATIONS_FALLBACK_SUMMARY : names.join(", ");
	}
}
