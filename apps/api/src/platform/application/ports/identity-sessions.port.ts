import type { SessionSystemRevoker } from "@workspace/shared";

/** Who revoked the sessions, written to each revoked session's `deletedBy`: a user (an admin making an RBAC change) or a closed system marker. */
export type SessionRevocationActor = { readonly kind: "user"; readonly userId: string } | { readonly kind: "system"; readonly marker: SessionSystemRevoker };

/**
 * Session revocation inside the CALLER's transaction (decision #42): the identity context owns device
 * sessions and `tokenVersion`; authorization calls this from its RBAC unit of work so the role change,
 * the revocation and the permission audit row commit or roll back together.
 *
 * Cached access-token state is dropped only after commit, by the caller's after-commit handler
 * (`UserAuthorizationChanged` → `authz:invalidate`).
 */
export interface IdentitySessionsPort {
	/** Revoke every live refresh token of `userIds` and bump their `tokenVersion`. An empty list is a no-op. */
	revokeAllSessions(userIds: readonly string[], revokedBy: SessionRevocationActor): Promise<void>;
}

/** Binds {@link IdentitySessionsPort} to one transaction. Provided under {@link IDENTITY_SESSIONS}. */
/** `TDb` is the caller's transaction client; infrastructure binds it (Prisma's transaction client). */
export interface IdentitySessionsPortFactory<TDb> {
	forTransaction(db: TDb): IdentitySessionsPort;
}

export const IDENTITY_SESSIONS = Symbol("IDENTITY_SESSIONS");
