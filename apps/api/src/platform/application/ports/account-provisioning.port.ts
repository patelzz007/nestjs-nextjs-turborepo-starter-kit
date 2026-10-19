/**
 * Accounts as the organizations context needs them (invite acceptance and
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

/** Account work that runs outside the caller's unit of work. */
export interface AccountProvisioningPort {
	hashPassword(password: string): Promise<string>;
	/**
	 * Create the account (with the default consumer role), or verify the
	 * existing one's password, refresh its name and ensure its default role.
	 * Idempotent: a retry or a concurrent completion finds the same account.
	 * Returns the account's user id.
	 */
	resolveOnboardingAccount(credentials: OnboardingAccountCredentials): Promise<string>;
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
}

export const ACCOUNT_PROVISIONING = Symbol("ACCOUNT_PROVISIONING");
