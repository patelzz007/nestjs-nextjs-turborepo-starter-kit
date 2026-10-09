// ============================================
// restore-session.ts - what the app finds on the device at start (§9.4, §9.6)
// ============================================
// Runs once per cold start, after the preferences loaded. Only the ACCESS
// token is read: the refresh token stays unread until the app lock (if on) is
// satisfied (§11.2).

import type { RestoredSession } from "./actions";
import { readSessionScope } from "./access-token-claims";

export interface RestoreSessionDependencies {
	readonly readAccessToken: () => Promise<string | null>;
	readonly appLockEnabled: boolean;
	/** The device's enrolled authentication is what it was when the lock was turned on. */
	readonly isEnrollmentUnchanged: () => Promise<boolean>;
	/** Turns the lock off and drops the session (biometrics changed). */
	readonly resetAppLock: () => Promise<void>;
	/** Drops a session that cannot be used (an unreadable access token). */
	readonly clearTokens: () => Promise<void>;
}

export async function restoreSession(dependencies: RestoreSessionDependencies): Promise<RestoredSession> {
	let accessToken: string | null;
	try {
		accessToken = await dependencies.readAccessToken();
	} catch {
		// The secret store is unreadable right now: start signed out; the tokens stay for the next start.
		return { status: "signedOut", reason: "none" };
	}
	if (accessToken === null) {
		return { status: "signedOut", reason: "none" };
	}
	const session = readSessionScope(accessToken);
	if (session === null) {
		await dependencies.clearTokens();
		return { status: "signedOut", reason: "sessionExpired" };
	}
	if (!dependencies.appLockEnabled) {
		return { status: "signedIn", session };
	}
	if (!(await dependencies.isEnrollmentUnchanged())) {
		await dependencies.resetAppLock();
		return { status: "signedOut", reason: "appLockReset" };
	}
	return { status: "locked" };
}
