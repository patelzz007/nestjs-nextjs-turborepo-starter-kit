import type { EpochMs } from "@workspace/shared";

import type { UserAccount } from "../aggregates/user-account.aggregate";
import type { EmailAddress } from "../value-objects/email-address.value-object";
import type { FailedSignInOutcome } from "../value-objects/lockout-state.value-object";

/** Accounts, bound to one unit-of-work transaction. */
export interface UserAccountRepository {
	findById(id: string): Promise<UserAccount | null>;

	findByEmail(email: EmailAddress): Promise<UserAccount | null>;

	/**
	 * Loads the account and takes its row lock (`SELECT … FOR UPDATE`) until the transaction ends:
	 * serializes a user's concurrent sign-ins (session cap, D15) and an administrator's concurrent
	 * impersonation starts (D36).
	 */
	lockById(id: string): Promise<UserAccount | null>;

	/** Whether any account, live or soft-deleted, uses the address (the email is unique across both). */
	existsByEmail(email: EmailAddress): Promise<boolean>;

	/** Inserts a new account. A concurrent insert of the same address throws `EmailAlreadyRegisteredError`. */
	add(account: UserAccount): Promise<void>;

	/** Applies the account's pending changes, each as a conditional write (see `UserAccountChange`). */
	save(account: UserAccount): Promise<void>;

	/**
	 * Counts one failed sign-in and decides the lock in ONE statement (D19): the counter can never
	 * be read stale, and a burst of failures locks the account once. `null` when the account vanished.
	 */
	recordFailedSignIn(userId: string, now: EpochMs): Promise<FailedSignInOutcome | null>;

	/** Clears the failed-attempt counter and any lock after a successful sign-in step (no write when already clear). */
	resetLockout(userId: string, now: EpochMs): Promise<void>;

	/** The account's most recent password hashes, newest first, at most `depth`. */
	recentPasswordHashes(userId: string, depth: number): Promise<readonly string[]>;

	/** Moves the token generation of every account in `userIds` (every issued access token stops working). */
	bumpTokenVersions(userIds: readonly string[], now: EpochMs): Promise<void>;

	/** Transaction-scoped advisory lock serializing every SuperAdmin bootstrap run (a second run waits, then sees the first). */
	lockSuperAdminBootstrap(): Promise<void>;

	/** Active, non-deleted accounts that are a SuperAdmin by the flag or by a live `SuperAdmin` role assignment. */
	countActiveSuperAdmins(superAdminRoleName: string): Promise<number>;

	/** Addresses of every active, non-deleted SuperAdmin (MFA recovery review notices). */
	activeSuperAdminEmails(): Promise<readonly EmailAddress[]>;
}
