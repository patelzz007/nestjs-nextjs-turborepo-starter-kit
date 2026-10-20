import type { AdminMerchantInvitePreviewQuery, EmailPreview, MembershipRole, PilotCity } from "@workspace/shared";

export interface TeamInviteEmail {
	readonly invitationId: string;
	readonly to: string;
	readonly tenantName: string;
	readonly role: MembershipRole;
	readonly locationSummary: string;
	readonly rawToken: string;
	readonly expiresInDays: number;
}

export interface MerchantInviteEmail {
	readonly invitationId: string;
	readonly to: string;
	readonly businessName: string;
	readonly city: PilotCity;
	readonly rawToken: string;
	readonly expiresInDays: number;
}

/**
 * The tenant emails (team and merchant invites), requested inside the
 * caller's unit of work (ADR 060): the email request commits or rolls back
 * with the invitation. A refused request (rate limit) is logged, never thrown:
 * the invitation stands and can be resent.
 */
export interface TenantEmailPort {
	sendTeamInvite(email: TeamInviteEmail): Promise<void>;
	sendMerchantInvite(email: MerchantInviteEmail): Promise<void>;
}

/** Renders the merchant invite email for the admin's live preview (sends nothing). */
export interface MerchantInviteEmailPreviewPort {
	previewMerchantInvite(query: AdminMerchantInvitePreviewQuery): EmailPreview;
}
