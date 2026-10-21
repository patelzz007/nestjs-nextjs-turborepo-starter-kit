import type { EpochMs } from "@workspace/shared";

import type { Membership, MembershipState } from "../aggregates/membership.aggregate";

/** A stored membership with its timestamps. */
export interface PersistedMembership extends MembershipState {
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
}

/** Persistence port of the {@link Membership} aggregate (bound to one unit of work). */
export interface MembershipRepository {
	nextId(): string;
	/** Whether the user holds a live (not deleted) membership of the tenant, in any status. */
	existsLive(tenantId: string, userId: string): Promise<boolean>;
	/** A live membership read under its row lock. */
	getLiveForUpdate(tenantId: string, membershipId: string): Promise<Membership | null>;
	/** The caller's live membership in any status (leaving accepts a suspended or pending one), under its row lock. */
	getOwnLiveForUpdate(tenantId: string, userId: string): Promise<Membership | null>;
	/** The caller's live ACTIVE membership read under its row lock. */
	getOwnActiveForUpdate(tenantId: string, userId: string): Promise<Membership | null>;
	/** Inserts the membership with its scope rows. A second live membership of the same user throws `AlreadyMemberError(duplicateMessage)`. */
	add(membership: Membership, duplicateMessage: string): Promise<void>;
	/** Writes the recorded changes (rename, store removal, leaving) and returns the stored row (soft-deleted after leaving). */
	save(membership: Membership): Promise<PersistedMembership>;
}
