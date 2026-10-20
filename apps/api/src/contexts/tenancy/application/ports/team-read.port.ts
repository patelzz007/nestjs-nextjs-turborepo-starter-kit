import type {
	EpochMs,
	LocationScopeType,
	TenantMemberInviteListQuery,
	TenantMemberInviteResponse,
	TenantMemberListQuery,
	TenantMemberRosterResponse,
	MembershipRole,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** A pending team invite as its link previews it. */
export interface TeamInvitePreviewView {
	readonly email: string;
	readonly tenant: { readonly slug: string; readonly displayName: string } | null;
	readonly intendedRole: MembershipRole;
	readonly locationScopeType: LocationScopeType;
	readonly locations: readonly { readonly id: string; readonly name: string }[];
	readonly expiresAt: EpochMs;
}

/** Team management reads (the manage-team capability is checked by the handler first). */
export interface TeamReadPort {
	/** One page of the live memberships with each member's name and email (one batched profile read per page). */
	listMembers(actor: ActorContext, tenantId: string, query: TenantMemberListQuery): Promise<PaginatedServiceResult<TenantMemberRosterResponse>>;
	/** One page of the pending team invites. */
	listPendingInvites(actor: ActorContext, tenantId: string, query: TenantMemberInviteListQuery): Promise<PaginatedServiceResult<TenantMemberInviteResponse>>;
	/** The PENDING team invite whose token hashes to `tokenHash`. */
	findPendingInvitePreview(tokenHash: string): Promise<TeamInvitePreviewView | null>;
}
