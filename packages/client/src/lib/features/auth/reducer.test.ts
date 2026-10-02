import { describe, expect, it } from "vitest";

import { sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { authActions } from "./actions";
import { authReducer } from "./reducer";
import { SESSION_CHECK_MAX_RETRIES } from "../../auth/session/session-check";
import {
	INITIAL_AUTH_SESSION_STATE,
	SERVER_RENDERED_SESSION_EPOCH,
	SESSION_CHECK_OK,
	type AuthSessionScope,
	type AuthSessionState,
	type SessionCheckState,
	type SignedOutReason,
} from "./state";

const FULL: AuthSessionScope = { sessionScope: "full", enrollmentReason: null };
const EMAIL_PENDING: AuthSessionScope = { sessionScope: "restricted", enrollmentReason: "email_verification" };
const MFA_PENDING: AuthSessionScope = { sessionScope: "restricted", enrollmentReason: "mfa_enrollment" };

const MEMBER_ID = "user-1";
const OTHER_MEMBER_ID = "user-2";

function authenticated(scope: AuthSessionScope = FULL, epoch = 0, userId = MEMBER_ID): AuthSessionState {
	return { status: "authenticated", userId, scope, epoch, check: SESSION_CHECK_OK };
}

function signedOut(reason: SignedOutReason, epoch = 1): AuthSessionState {
	return { status: "signed-out", reason, epoch, check: SESSION_CHECK_OK };
}

describe("authReducer", () => {
	it("starts unknown, in the server-rendered epoch", () => {
		expect(INITIAL_AUTH_SESSION_STATE).toEqual({ status: "unknown", epoch: SERVER_RENDERED_SESSION_EPOCH, check: SESSION_CHECK_OK });
	});

	it("establishes a session with the scope the sign-in reported — always as a new epoch", () => {
		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionEstablished(userFixture(), EMAIL_PENDING))).toEqual(authenticated(EMAIL_PENDING, 1));
		expect(authReducer(signedOut("signed-out", 3), authActions.sessionEstablished(userFixture(), FULL))).toEqual(authenticated(FULL, 4));
		expect(authReducer(authenticated(EMAIL_PENDING, 2), authActions.sessionEstablished(userFixture(), FULL))).toEqual(authenticated(FULL, 3));
	});

	it("restores a session with the scope /auth/permissions reports, keeping the server-rendered epoch on the first check", () => {
		const permissions = sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "email_verification" });

		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionRestored(userFixture(), permissions))).toEqual(authenticated(EMAIL_PENDING, 0));
	});

	it("restores a full session when /auth/permissions did not answer", () => {
		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionRestored(userFixture(), null))).toEqual(authenticated(FULL, 0));
	});

	it("keeps the epoch when the same member is re-confirmed, and starts a new one for anyone else", () => {
		expect(authReducer(authenticated(FULL, 2), authActions.sessionRestored(userFixture({ id: MEMBER_ID }), null))).toEqual(authenticated(FULL, 2));
		expect(authReducer(authenticated(FULL, 2), authActions.sessionRestored(userFixture({ id: OTHER_MEMBER_ID }), null))).toEqual(authenticated(FULL, 3, OTHER_MEMBER_ID));
		expect(authReducer(signedOut("no-session", 1), authActions.sessionRestored(userFixture(), null))).toEqual(authenticated(FULL, 2));
	});

	it("derives the enrollment reason of a restricted session from the verified flag", () => {
		const permissions = sessionPermissionsFixture({ sessionScope: "restricted" });

		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionRestored(userFixture({ isEmailVerified: true }), permissions))).toEqual(authenticated(MFA_PENDING, 0));
		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionRestored(userFixture({ isEmailVerified: false }), permissions))).toEqual(
			authenticated(EMAIL_PENDING, 0),
		);
	});

	it("reads a session check without a session as signed out, in a new epoch — from unknown or a known session", () => {
		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionNotFound())).toEqual(signedOut("no-session", 1));
		expect(authReducer(authenticated(FULL, 2), authActions.sessionNotFound())).toEqual(signedOut("no-session", 3));
	});

	it("leaves a signed-out tab as it is when a later check finds nothing (an invalidated one stays invalidated)", () => {
		const expired = signedOut("session-expired", 4);
		const guest = signedOut("no-session", 1);

		expect(authReducer(expired, authActions.sessionNotFound())).toBe(expired);
		expect(authReducer(guest, authActions.sessionNotFound())).toBe(guest);
	});

	it("settles only the first check when the route skips it, without leaving the server-rendered epoch", () => {
		expect(authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionCheckSkipped())).toEqual(signedOut("no-session", 0));

		const signedIn = authenticated(MFA_PENDING);
		const signedOutState = signedOut("signed-out");
		expect(authReducer(signedIn, authActions.sessionCheckSkipped())).toBe(signedIn);
		expect(authReducer(signedOutState, authActions.sessionCheckSkipped())).toBe(signedOutState);
	});

	it("applies a changed scope only to an authenticated session", () => {
		const signedOutState = signedOut("signed-out");

		expect(authReducer(authenticated(EMAIL_PENDING), authActions.sessionScopeChanged(FULL))).toEqual(authenticated(FULL));
		expect(authReducer(signedOutState, authActions.sessionScopeChanged(FULL))).toBe(signedOutState);
	});

	it("lifts an email-verification restriction but keeps a pending MFA enrollment on email verification", () => {
		const guest = signedOut("no-session");

		expect(authReducer(authenticated(EMAIL_PENDING), authActions.emailVerified())).toEqual(authenticated(FULL));
		expect(authReducer(authenticated(MFA_PENDING), authActions.emailVerified())).toEqual(authenticated(MFA_PENDING));
		expect(authReducer(guest, authActions.emailVerified())).toBe(guest);
	});

	it("records why the session ended, each in a new epoch", () => {
		expect(authReducer(authenticated(FULL, 0), authActions.signedOut())).toEqual(signedOut("signed-out", 1));
		expect(authReducer(authenticated(FULL, 0), authActions.sessionExpired())).toEqual(signedOut("session-expired", 1));
		expect(authReducer(authenticated(FULL, 0), authActions.signedOutInAnotherTab())).toEqual(signedOut("signed-out-in-another-tab", 1));
	});

	it("does not change state when the server session is cleared", () => {
		const signedOutState = signedOut("signed-out");

		expect(authReducer(signedOutState, authActions.serverSessionCleared(true))).toBe(signedOutState);
	});

	it("never stores the profile or a token — only status, subject id, scope, epoch and the check's progress", () => {
		const state = authReducer(INITIAL_AUTH_SESSION_STATE, authActions.sessionEstablished(userFixture({ email: "secret@example.com" }), FULL));

		expect(Object.keys(state).sort()).toEqual(["check", "epoch", "scope", "status", "userId"]);
		expect(JSON.stringify(state)).not.toContain("secret@example.com");
	});
});

describe("authReducer — a session check that reached no verdict", () => {
	const UNKNOWN: AuthSessionState = INITIAL_AUTH_SESSION_STATE;

	function failedTimes(state: AuthSessionState, times: number): AuthSessionState {
		let next = state;
		for (let attempt = 0; attempt < times; attempt += 1) {
			next = authReducer(next, authActions.sessionCheckFailed("server-error"));
		}
		return next;
	}

	function retrying(failedAttempts: number): SessionCheckState {
		return { status: "retrying", reason: "server-error", failedAttempts };
	}

	it("keeps an authenticated tab authenticated, in the same epoch — only the check changes", () => {
		const signedIn = authenticated(MFA_PENDING, 2);

		expect(authReducer(signedIn, authActions.sessionCheckFailed("server-error"))).toEqual({ ...signedIn, check: retrying(1) });
	});

	it("keeps an unknown tab unknown — never signed out — and records why", () => {
		expect(authReducer(UNKNOWN, authActions.sessionCheckFailed("timeout"))).toEqual({
			status: "unknown",
			epoch: SERVER_RENDERED_SESSION_EPOCH,
			check: { status: "retrying", reason: "timeout", failedAttempts: 1 },
		});
	});

	it("keeps the latest reason and counts consecutive failures", () => {
		const twice = authReducer(authReducer(UNKNOWN, authActions.sessionCheckFailed("network")), authActions.sessionCheckFailed("rate-limited"));

		expect(twice.check).toEqual({ status: "retrying", reason: "rate-limited", failedAttempts: 2 });
	});

	it("retries within the budget and pauses once it is spent", () => {
		expect(failedTimes(UNKNOWN, SESSION_CHECK_MAX_RETRIES).check).toEqual(retrying(SESSION_CHECK_MAX_RETRIES));
		expect(failedTimes(UNKNOWN, SESSION_CHECK_MAX_RETRIES + 1).check).toEqual({ status: "paused", reason: "server-error", failedAttempts: SESSION_CHECK_MAX_RETRIES + 1 });
	});

	it("starts a new retry series on a recheck request, keeping the last reason", () => {
		const paused = failedTimes(authenticated(), SESSION_CHECK_MAX_RETRIES + 1);

		expect(authReducer(paused, authActions.sessionRecheckRequested("online"))).toEqual({ ...authenticated(), check: retrying(0) });
	});

	it("ignores a recheck request when no check failed", () => {
		const signedIn = authenticated();

		expect(authReducer(signedIn, authActions.sessionRecheckRequested("visible"))).toBe(signedIn);
	});

	it("ends the series with a verdict: a restored session or none", () => {
		const failing = failedTimes(UNKNOWN, 3);

		expect(authReducer(failing, authActions.sessionRestored(userFixture(), null))).toEqual(authenticated(FULL, 0));
		expect(authReducer(failing, authActions.sessionNotFound())).toEqual(signedOut("no-session", 1));
	});

	it("ends the series at every session boundary", () => {
		const failing = failedTimes(authenticated(FULL, 0), 2);

		expect(authReducer(failing, authActions.signedOut())).toEqual(signedOut("signed-out", 1));
		expect(authReducer(failing, authActions.sessionExpired())).toEqual(signedOut("session-expired", 1));
		expect(authReducer(failing, authActions.signedOutInAnotherTab())).toEqual(signedOut("signed-out-in-another-tab", 1));
		expect(authReducer(failing, authActions.sessionEstablished(userFixture(), FULL))).toEqual(authenticated(FULL, 1));
	});

	it("settles a signed-out tab's failing check when a later check finds nothing, keeping its reason", () => {
		const failing = failedTimes(signedOut("session-expired", 4), 1);

		expect(authReducer(failing, authActions.sessionNotFound())).toEqual(signedOut("session-expired", 4));
	});

	it("settles the check when the route stops checking", () => {
		const failing = failedTimes(authenticated(), 1);

		expect(authReducer(failing, authActions.sessionCheckSkipped())).toEqual(authenticated());
		expect(authReducer(failedTimes(UNKNOWN, 1), authActions.sessionCheckSkipped())).toEqual(signedOut("no-session", 0));
	});

	it("keeps a failing check through scope changes", () => {
		const failing = failedTimes(authenticated(EMAIL_PENDING), 1);

		expect(authReducer(failing, authActions.sessionScopeChanged(FULL))).toEqual({ ...authenticated(FULL), check: retrying(1) });
	});
});
