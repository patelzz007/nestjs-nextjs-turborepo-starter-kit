import { z } from "zod";

/**
 * WHY a set of users' authorization state was invalidated. Carried on the `authz:invalidate` pub/sub
 * message so every instance's debug line names the action behind it.
 */
export const UserInvalidationTriggerSchema = z.enum([
	/** An RBAC mutation (role/permission/assignment change) committed. See the permission audit log. */
	"rbac_mutation",
	/** The user signed out of every device. */
	"logout_all_devices",
	/** One device session was revoked (signed out, or revoked from the device list, ADR 034). */
	"session_revoked",
	/** A rotated refresh token was replayed (theft signal): every session was revoked. */
	"refresh_token_reuse",
	/** The user changed their password. */
	"password_changed",
	/** The user completed a password reset. */
	"password_reset",
	/** An approved MFA recovery reached its scheduled unlock. */
	"mfa_recovery_completed",
	/**
	 * This instance's sweep of `User.authorizationChangedAt` found an access change it had not yet
	 * applied — the backstop for an after-commit invalidation that never arrived.
	 */
	"authorization_change_sweep",
]);
export type UserInvalidationTrigger = z.output<typeof UserInvalidationTriggerSchema>;

/** What changed for a set of users. */
export interface UserInvalidationScope {
	/** Their sessions were revoked (tokenVersion bumped): drop cached access-token state everywhere too. */
	readonly accessTokenState: boolean;
	readonly trigger: UserInvalidationTrigger;
}

/** Which compiled policy bundles a policy publish made stale. */
export type PolicyBundleInvalidationScope = { readonly kind: "tenant"; readonly tenantId: string } | { readonly kind: "all" };

/**
 * The single place authorization state is invalidated AFTER commit, on this instance and (through Redis
 * `authz:invalidate`) on every other one. At-most-once: a lost message is caught by every instance's
 * sweep of the durable `User.authorizationChangedAt` stamp (identity's `AuthorizationChangeSweep`)
 * within one sweep interval.
 */
export interface AuthorizationCacheInvalidationPort {
	invalidateUsers(userIds: readonly string[], scope: UserInvalidationScope): Promise<void>;
	/**
	 * Drop cached authorization and access-token state for `userIds` on THIS instance only — for the
	 * durable sweep every instance runs over the access-change stamps: each instance applies what it
	 * reads itself, so nothing is broadcast.
	 */
	invalidateUsersOnThisInstance(userIds: readonly string[], trigger: UserInvalidationTrigger): void;
	/** Drop every cached authorization entry (catalog-wide changes such as a registry sync). */
	clearAll(): Promise<void>;
	invalidatePolicyBundles(scope: PolicyBundleInvalidationScope): Promise<void>;
}
