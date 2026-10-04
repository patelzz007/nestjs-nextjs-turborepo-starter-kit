// How long the single-use links the API emails stay valid. One definition
// for the API (which signs/stores the token with this lifetime and states it
// in the email) and the frontends (which tell the user how long the link
// lasts), so the copy can never drift from the real expiry.

/** Hours an email-verification link stays valid. */
export const EMAIL_VERIFICATION_LINK_TTL_HOURS = 24;

/** Hours a password-reset link stays valid. */
export const PASSWORD_RESET_LINK_TTL_HOURS = 1;

/** "1 hour" / "24 hours" — the lifetime as user-facing copy. */
export function formatLinkLifetimeHours(hours: number): string {
	return hours === 1 ? "1 hour" : `${String(hours)} hours`;
}
