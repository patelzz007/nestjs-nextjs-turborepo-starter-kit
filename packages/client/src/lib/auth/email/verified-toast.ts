import { browserStorage } from "../../state/browser-storage";

const EMAIL_VERIFIED_TOAST_KEY = "auth:email-verified";

/** Mark that the next settings visit should show the email-verified toast. */
export function markEmailVerifiedToast(): void {
	browserStorage("session").setItem(EMAIL_VERIFIED_TOAST_KEY, "1");
}

/** Returns true once, then clears the flag. */
export function consumeEmailVerifiedToast(): boolean {
	const storage = browserStorage("session");
	if (storage.getItem(EMAIL_VERIFIED_TOAST_KEY) !== "1") {
		return false;
	}
	storage.removeItem(EMAIL_VERIFIED_TOAST_KEY);
	return true;
}
