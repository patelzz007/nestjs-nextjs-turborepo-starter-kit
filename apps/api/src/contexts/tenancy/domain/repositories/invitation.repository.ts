import type { Invitation } from "../aggregates/invitation.aggregate";

/** Persistence port of the {@link Invitation} aggregate (bound to one unit of work). */
export interface InvitationRepository {
	nextId(): string;
	/** The PENDING team invite whose token hashes to `tokenHash`. */
	findPendingTeamInviteByTokenHash(tokenHash: string): Promise<Invitation | null>;
	findPendingTeamInvite(tenantId: string, invitationId: string): Promise<Invitation | null>;
	findPendingTeamInviteByEmail(tenantId: string, email: string): Promise<Invitation | null>;
	/** The PENDING onboarding invite whose token hashes to `tokenHash`. */
	findPendingOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null>;
	/** The ACCEPTED onboarding invite whose token hashes to `tokenHash` (its document window may or may not be open). */
	findAcceptedOnboardingInviteByTokenHash(tokenHash: string): Promise<Invitation | null>;
	/** Inserts a new invitation (with its store scope). A second PENDING invite for the same email throws `InvitePendingError`. */
	add(invitation: Invitation): Promise<void>;
	/** Compare-and-set of the recorded transition on the loaded status; a lost race throws the invitation kind's conflict error. */
	save(invitation: Invitation): Promise<void>;
}
