import type { EpochMs, MerchantKybProfileResponse, TenantInvitationStatus, PilotCity } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { KybFileDescriptor } from "./kyb-files.port";

/** An onboarding invite with the tenant it provisions. */
export interface OnboardingInviteView {
	readonly id: string;
	readonly email: string;
	readonly status: TenantInvitationStatus;
	readonly tenantId: string;
	readonly tenantSlug: string;
	readonly businessName: string;
	readonly city: PilotCity;
	readonly expiresAt: EpochMs;
	readonly acceptedByUserId: string | null;
	readonly acceptedAt: EpochMs | null;
	readonly documentsSubmittedAt: EpochMs | null;
}

/** Whose session reads the evidence: the member's own (tenant RLS), or a platform admin's cross-tenant review read. */
export type KybEvidenceReader = "member" | "admin";

/** KYB reads: the merchant's profile, its active evidence and the onboarding invites. */
export interface KybReadPort {
	/** `null` when the tenant has no merchant profile. */
	getProfile(actor: ActorContext, tenantId: string): Promise<MerchantKybProfileResponse | null>;
	/** One file of the tenant's active evidence; `null` when it is not part of it. */
	findActiveEvidence(actor: ActorContext, tenantId: string, fileId: string, reader: KybEvidenceReader): Promise<KybFileDescriptor | null>;
	/** The onboarding invite whose token hashes to `tokenHash`, in one of `statuses`; `null` when none (or its tenant has no merchant profile). */
	findOnboardingInvite(tokenHash: string, statuses: readonly TenantInvitationStatus[]): Promise<OnboardingInviteView | null>;
}
