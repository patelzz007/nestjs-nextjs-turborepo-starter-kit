// Carries the login response's enrollment message across the post-login
// redirect to the account page (browser-only, session storage).
import { browserStorage } from "../../state/browser-storage";

const ENROLLMENT_MESSAGE_KEY = "auth:enrollment-message";

/** Persist an enrollment banner message across the post-login redirect. */
export function markEnrollmentMessage(message: string): void {
	browserStorage("session").setItem(ENROLLMENT_MESSAGE_KEY, message);
}

/** Returns the stored enrollment message once, then clears it. */
export function consumeEnrollmentMessage(): string | null {
	const storage = browserStorage("session");
	const value = storage.getItem(ENROLLMENT_MESSAGE_KEY);
	if (value === null) {
		return null;
	}
	storage.removeItem(ENROLLMENT_MESSAGE_KEY);
	return value;
}
