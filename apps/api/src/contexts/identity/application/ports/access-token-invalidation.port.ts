import type { CredentialChangeReason, SessionRevocationReason } from "../../domain/events/identity.events";

/** Why access-token state is dropped: a credential change or a session revocation. */
export type AccessTokenInvalidationReason = CredentialChangeReason | SessionRevocationReason;

/**
 * Drops cached access-token state (and cached authorization) for users on EVERY API instance, after
 * commit. Delivery is best effort; the cache TTL is the backstop (the revocation is already durable).
 */
export interface AccessTokenInvalidationPort {
	invalidateUsers(userIds: readonly string[], reason: AccessTokenInvalidationReason): Promise<void>;
}
