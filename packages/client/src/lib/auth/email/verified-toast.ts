const EMAIL_VERIFIED_TOAST_KEY = "rewardhub:email-verified";

/** Mark that the next settings visit should show the email-verified toast. */
export function markEmailVerifiedToast(): void {
	sessionStorage.setItem(EMAIL_VERIFIED_TOAST_KEY, "1");
}

/** Returns true once, then clears the flag. */
export function consumeEmailVerifiedToast(): boolean {
	const value = sessionStorage.getItem(EMAIL_VERIFIED_TOAST_KEY);
	if (value !== "1") {
		return false;
	}
	sessionStorage.removeItem(EMAIL_VERIFIED_TOAST_KEY);
	return true;
}
