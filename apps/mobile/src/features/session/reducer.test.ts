import type { SessionScopeInfo } from "./access-token-claims";
import { sessionActions, type SessionAction } from "./actions";
import { sessionReducer } from "./reducer";
import { INITIAL_SESSION_STATE, type SessionState } from "./state";

const FULL: SessionScopeInfo = { scope: "full" };
const RESTRICTED: SessionScopeInfo = { scope: "restricted", enrollmentReason: "mfa_enrollment" };

const SIGNED_IN: SessionState = { status: "signedIn", session: FULL };
const SIGNED_OUT: SessionState = { status: "signedOut", reason: "none" };
const LOCKED: SessionState = { status: "locked" };
const UPGRADE: SessionState = { status: "upgradeRequired", minimumVersion: "2.0.0" };

function run(state: SessionState, ...actions: SessionAction[]): SessionState {
	return actions.reduce(sessionReducer, state);
}

describe("sessionReducer — the root guard's transitions (§9.6)", () => {
	it.each([
		["no tokens", sessionActions.restored({ status: "signedOut", reason: "none" }), SIGNED_OUT],
		["tokens + app lock on", sessionActions.restored({ status: "locked" }), LOCKED],
		["tokens + app lock off", sessionActions.restored({ status: "signedIn", session: FULL }), SIGNED_IN],
	])("Unknown → restored with %s", (_what, action, expected) => {
		expect(sessionReducer(INITIAL_SESSION_STATE, action)).toEqual(expected);
	});

	it("restores only once", () => {
		expect(run(SIGNED_OUT, sessionActions.restored({ status: "locked" }))).toEqual(SIGNED_OUT);
	});

	it("Locked → SignedIn on unlock; Locked → SignedOut on Sign out", () => {
		expect(run(LOCKED, sessionActions.unlocked(FULL))).toEqual(SIGNED_IN);
		expect(run(LOCKED, sessionActions.signedOut("signedOut"))).toEqual({ status: "signedOut", reason: "signedOut" });
	});

	it("SignedIn → Locked when the lock is due; nothing else can lock", () => {
		expect(run(SIGNED_IN, sessionActions.locked())).toEqual(LOCKED);
		expect(run(SIGNED_OUT, sessionActions.locked())).toEqual(SIGNED_OUT);
		expect(run(INITIAL_SESSION_STATE, sessionActions.locked())).toEqual(INITIAL_SESSION_STATE);
	});

	it("only a locked app unlocks", () => {
		expect(run(SIGNED_OUT, sessionActions.unlocked(FULL))).toEqual(SIGNED_OUT);
	});

	it("SignedIn → SignedOut on sign out or session end", () => {
		expect(run(SIGNED_IN, sessionActions.signedOut("signedOut"))).toEqual({ status: "signedOut", reason: "signedOut" });
		expect(run(SIGNED_IN, sessionActions.expired())).toEqual({ status: "signedOut", reason: "sessionExpired" });
		expect(run(LOCKED, sessionActions.expired())).toEqual({ status: "signedOut", reason: "sessionExpired" });
	});

	it("a session that does not exist cannot expire, and starting cannot be signed out", () => {
		expect(run(SIGNED_OUT, sessionActions.expired())).toEqual(SIGNED_OUT);
		expect(run(INITIAL_SESSION_STATE, sessionActions.signedOut("signedOut"))).toEqual(INITIAL_SESSION_STATE);
	});

	it("SignedOut → SignedIn when the sign-in flow completes", () => {
		expect(run(SIGNED_OUT, sessionActions.signedIn(FULL))).toEqual(SIGNED_IN);
		expect(run(LOCKED, sessionActions.signedIn(FULL))).toEqual(LOCKED);
	});

	it("a restricted session becomes full when its tokens rotate (forced enrollment completed)", () => {
		const restricted = run(SIGNED_OUT, sessionActions.signedIn(RESTRICTED));
		expect(restricted).toEqual({ status: "signedIn", session: RESTRICTED });
		expect(run(restricted, sessionActions.tokensRotated(FULL))).toEqual(SIGNED_IN);
		expect(run(SIGNED_OUT, sessionActions.tokensRotated(FULL))).toEqual(SIGNED_OUT);
	});

	it.each([INITIAL_SESSION_STATE, SIGNED_OUT, SIGNED_IN, LOCKED])("any state → UpgradeRequired on a 426 (%o)", (state) => {
		expect(run(state, sessionActions.upgradeRequired("2.0.0"))).toEqual(UPGRADE);
	});

	it("UpgradeRequired cannot be left", () => {
		expect(
			run(
				UPGRADE,
				sessionActions.signedIn(FULL),
				sessionActions.signedOut("signedOut"),
				sessionActions.unlocked(FULL),
				sessionActions.expired(),
				sessionActions.restored({ status: "signedOut", reason: "none" }),
				sessionActions.upgradeRequired(null),
			),
		).toEqual(UPGRADE);
	});
});
