import { describe, expect, it } from "vitest";

import {
	isSameSessionScope,
	selectAuthStatus,
	selectIsAuthenticated,
	selectIsServerRenderedSession,
	selectIsSessionInvalidated,
	selectIsSessionPending,
	selectSessionCheck,
	selectSessionEpoch,
	selectSessionScope,
	selectSessionUserId,
	selectSignedOutReason,
} from "./selectors";
import { SESSION_CHECK_OK, type AuthSessionScope, type AuthSessionState, type SignedOutReason } from "./state";

const FULL: AuthSessionScope = { sessionScope: "full", enrollmentReason: null };
const UNKNOWN: AuthSessionState = { status: "unknown", epoch: 0, check: SESSION_CHECK_OK };
const AUTHENTICATED: AuthSessionState = { status: "authenticated", userId: "user-1", scope: FULL, epoch: 0, check: SESSION_CHECK_OK };

function signedOut(reason: SignedOutReason): AuthSessionState {
	return { status: "signed-out", reason, epoch: 1, check: SESSION_CHECK_OK };
}

describe("auth selectors", () => {
	it("derive authentication and loading from the status — never stored twice", () => {
		expect([UNKNOWN, AUTHENTICATED, signedOut("no-session")].map(selectAuthStatus)).toEqual(["unknown", "authenticated", "signed-out"]);
		expect([UNKNOWN, AUTHENTICATED, signedOut("no-session")].map(selectIsAuthenticated)).toEqual([false, true, false]);
		expect([UNKNOWN, AUTHENTICATED, signedOut("no-session")].map(selectIsSessionPending)).toEqual([true, false, false]);
	});

	it("expose the scope only while authenticated", () => {
		expect(selectSessionScope(AUTHENTICATED)).toBe(FULL);
		expect(selectSessionScope(UNKNOWN)).toBeNull();
		expect(selectSessionScope(signedOut("signed-out"))).toBeNull();
	});

	it("expose the session's subject only while authenticated", () => {
		expect(selectSessionUserId(AUTHENTICATED)).toBe("user-1");
		expect(selectSessionUserId(UNKNOWN)).toBeNull();
		expect(selectSessionUserId(signedOut("signed-out"))).toBeNull();
	});

	it("treat only epoch 0 as the session the server rendered the page for", () => {
		expect(selectSessionEpoch(signedOut("signed-out"))).toBe(1);
		expect(selectIsServerRenderedSession(UNKNOWN)).toBe(true);
		expect(selectIsServerRenderedSession(AUTHENTICATED)).toBe(true);
		expect(selectIsServerRenderedSession(signedOut("signed-out"))).toBe(false);
	});

	it("expose why the session ended", () => {
		expect(selectSignedOutReason(signedOut("session-expired"))).toBe("session-expired");
		expect(selectSignedOutReason(AUTHENTICATED)).toBeNull();
	});

	it("treat every way of losing a session as invalidated, but not a session that was never there", () => {
		expect(selectIsSessionInvalidated(signedOut("signed-out"))).toBe(true);
		expect(selectIsSessionInvalidated(signedOut("session-expired"))).toBe(true);
		expect(selectIsSessionInvalidated(signedOut("signed-out-in-another-tab"))).toBe(true);
		expect(selectIsSessionInvalidated(signedOut("no-session"))).toBe(false);
		expect(selectIsSessionInvalidated(UNKNOWN)).toBe(false);
		expect(selectIsSessionInvalidated(AUTHENTICATED)).toBe(false);
	});

	it("compare scopes by value", () => {
		expect(isSameSessionScope(FULL, { sessionScope: "full", enrollmentReason: null })).toBe(true);
		expect(isSameSessionScope(FULL, { sessionScope: "restricted", enrollmentReason: "mfa_enrollment" })).toBe(false);
		expect(
			isSameSessionScope({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }, { sessionScope: "restricted", enrollmentReason: "email_verification" }),
		).toBe(false);
	});

	it("keep an unknown tab pending while its check cannot reach the API — never read as signed out", () => {
		const unreachable: AuthSessionState = { ...UNKNOWN, check: { status: "retrying", reason: "server-error", failedAttempts: 1 } };

		expect(selectIsSessionPending(unreachable)).toBe(true);
		expect(selectIsAuthenticated(unreachable)).toBe(false);
		expect(selectSignedOutReason(unreachable)).toBeNull();
		expect(selectSessionCheck(unreachable)).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });
		expect(selectSessionCheck(AUTHENTICATED)).toBe(SESSION_CHECK_OK);
	});
});
