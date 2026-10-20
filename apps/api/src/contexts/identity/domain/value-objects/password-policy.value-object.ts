import { strongPassword } from "@workspace/shared";

import { PasswordReusedError, WeakPasswordError } from "../errors/identity.errors";

/**
 * How many of the account's most recent password hashes a new password is compared against.
 * Reusing any of the last five is refused (password change and reset alike).
 */
export const PASSWORD_HISTORY_DEPTH = 5;

/**
 * The password rules of an account: the shared strength contract (the same `strongPassword`
 * schema the client validates against) plus the history rule. The plaintext never leaves the
 * call that checks it; history matching itself is a hashing concern, so callers pass the result.
 */
export class PasswordPolicy {
	/** Throws {@link WeakPasswordError} when `plaintext` fails the shared strength contract. */
	public static assertStrong(plaintext: string): void {
		if (!strongPassword.safeParse(plaintext).success) {
			throw new WeakPasswordError();
		}
	}

	/**
	 * `matchedRecentPassword` is whether the candidate matched one of the last
	 * {@link PASSWORD_HISTORY_DEPTH} stored hashes. Throws {@link PasswordReusedError} when it did.
	 */
	public static assertNotReused(matchedRecentPassword: boolean): void {
		if (matchedRecentPassword) {
			throw new PasswordReusedError();
		}
	}
}
