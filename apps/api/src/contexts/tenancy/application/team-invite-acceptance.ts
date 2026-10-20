import type { EpochMs } from "@workspace/shared";

import { Membership } from "../domain/aggregates/membership.aggregate";
import type { Invitation } from "../domain/aggregates/invitation.aggregate";
import { AlreadyMemberError } from "../domain/errors/tenants.errors";
import { NotFoundError } from "../../../platform/application/errors/app-error";
import { notFound } from "./tenant-actor";
import type { TenantsScope } from "./tenants-scope";

/** One answer for an unknown, used, revoked or never-issued team invite token (no oracle). */
export function invalidTeamInviteLink(): NotFoundError {
	return new NotFoundError({ message: "This invitation link is invalid, expired, or has already been used" });
}

/** Who already holds the membership when an accept lands twice. */
export const ACCEPTER_ALREADY_MEMBER_MESSAGE = "You are already a member of this tenant";

/**
 * Claims the invite (compare-and-set PENDING → ACCEPTED: unexpired, not
 * revoked, not already accepted), then grants the membership with the
 * invite's role and scope and audits it — all in the caller's unit of work.
 * Returns the slug of the tenant the invitee joined.
 */
export async function acceptTeamInviteInScope(scope: TenantsScope, invite: Invitation, userId: string, now: EpochMs): Promise<string> {
	const tenantId = invite.tenantId;
	if (tenantId === null) {
		throw notFound();
	}
	invite.accept(userId, now);
	await scope.invitations.save(invite);
	const tenant = await scope.tenants.findById(tenantId);
	if (tenant === null) {
		throw notFound();
	}
	if (await scope.memberships.existsLive(tenantId, userId)) {
		throw new AlreadyMemberError(ACCEPTER_ALREADY_MEMBER_MESSAGE);
	}
	const membership = Membership.grant(scope.memberships.nextId(), tenantId, userId, invite.intendedRole, invite.scope, now);
	await scope.memberships.add(membership, ACCEPTER_ALREADY_MEMBER_MESSAGE);
	await scope.audit.record({
		tenantId,
		actorUserId: userId,
		policyVersion: await scope.tenantPolicies.activePolicyVersion(tenantId),
		action: "membership.invite_accepted",
		resourceType: "TenantInvitation",
		resourceId: invite.id,
		metadata: { membershipId: membership.id, role: invite.intendedRole, locationScopeType: invite.scope.type },
	});
	scope.events.collectFrom(invite);
	scope.events.collectFrom(membership);
	return tenant.slug;
}
