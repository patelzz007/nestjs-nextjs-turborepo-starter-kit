/**
 * Accounts as the tenants context needs them (invite acceptance and
 * merchant onboarding). Owned by identity; declared here
 * until `contexts/identity/public-api.ts` exports it (migration plan §6.3).
 */

/** The name and sign-in address shown for a member on the team roster. */
export interface AccountProfile {
	readonly userId: string;
	readonly email: string;
	readonly fullName: string;
}

/** A new consumer account (default consumer role included). The password is already hashed. */
export interface NewAccount {
	readonly email: string;
	readonly passwordHash: string;
	readonly fullName: string;
}

/** The outcome of creating an account: the address may already be registered (a concurrent registration won). */
export type CreatedAccount = { readonly kind: "created"; readonly userId: string } | { readonly kind: "email_taken" };

/** The merchant's sign-in on the onboarding form: a new account, or the existing one's password. */
export interface OnboardingAccountCredentials {
	readonly email: string;
	readonly password: string;
	readonly fullName: string;
}

/**
 * How onboarding will treat the merchant's account, decided before its transaction and without writing
 * anything: an existing account whose password was just verified, or a new one with its password hashed.
 */
export type OnboardingAccountPlan = { readonly kind: "existing"; readonly userId: string } | { readonly kind: "new"; readonly passwordHash: string };

/** Account work that runs outside the caller's unit of work. */
export interface AccountProvisioningPort {
	hashPassword(password: string): Promise<string>;
	/**
	 * Read-only: verify the existing account's password (refused when it does not match), or hash the
	 * password of the account onboarding will create. Nothing is written, so a failed onboarding leaves
	 * no account behind; the caller creates or refreshes the account inside its own transaction.
	 */
	checkOnboardingCredentials(credentials: Pick<OnboardingAccountCredentials, "email" | "password">): Promise<OnboardingAccountPlan>;
	/**
	 * The default consumer role on an EXISTING account, in its own RBAC transaction (sessions revoked and
	 * cached authorization dropped after commit). Idempotent. Callers run it only after their own work committed.
	 */
	ensureDefaultRole(userId: string): Promise<void>;
	/** Whether a live account is registered with `email` (invite previews). */
	accountExists(email: string): Promise<boolean>;
	/** Sends the verify-email message when the account is not verified yet. */
	sendVerificationEmailIfUnverified(email: string, clientType: string): Promise<void>;
}

/** Account work bound to the caller's unit-of-work transaction. */
export interface TransactionalAccountProvisioningPort {
	/** The live account registered with `email`, or `null`. */
	findAccountIdByEmail(email: string): Promise<string | null>;
	/** Creates the account and its default consumer role in the caller's transaction. */
	createAccount(account: NewAccount): Promise<CreatedAccount>;
	/** Live accounts among `userIds` (one batched read). */
	listProfiles(userIds: readonly string[]): Promise<readonly AccountProfile[]>;
	/** Sets an existing account's display name in the caller's transaction (no-op when it is unchanged). */
	renameAccount(userId: string, fullName: string): Promise<void>;
}

export const ACCOUNT_PROVISIONING = Symbol("ACCOUNT_PROVISIONING");
