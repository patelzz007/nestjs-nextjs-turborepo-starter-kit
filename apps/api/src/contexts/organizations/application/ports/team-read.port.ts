import type {
	EpochMs,
	OrganizationLocationScopeType,
	OrganizationMemberInviteListQuery,
	OrganizationMemberInviteResponse,
	OrganizationMemberListQuery,
	OrganizationMemberRosterResponse,
	OrganizationMembershipRole,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** A pending team invite as its link previews it. */
export interface TeamInvitePreviewView {
	readonly email: string;
	readonly organization: { readonly slug: string; readonly displayName: string } | null;
	readonly intendedRole: OrganizationMembershipRole;
	readonly locationScopeType: OrganizationLocationScopeType;
	readonly locations: readonly { readonly id: string; readonly name: string }[];
	readonly expiresAt: EpochMs;
}

/** Team management reads (the manage-team capability is checked by the handler first). */
export interface TeamReadPort {
	/** One page of the live memberships with each member's name and email (one batched profile read per page). */
	listMembers(actor: ActorContext, organizationId: string, query: OrganizationMemberListQuery): Promise<PaginatedServiceResult<OrganizationMemberRosterResponse>>;
	/** One page of the pending team invites. */
	listPendingInvites(actor: ActorContext, organizationId: string, query: OrganizationMemberInviteListQuery): Promise<PaginatedServiceResult<OrganizationMemberInviteResponse>>;
	/** The PENDING team invite whose token hashes to `tokenHash`. */
	findPendingInvitePreview(tokenHash: string): Promise<TeamInvitePreviewView | null>;
}
