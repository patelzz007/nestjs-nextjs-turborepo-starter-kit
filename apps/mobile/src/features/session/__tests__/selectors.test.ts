import { selectCanReadRefreshToken, selectMinimumVersion, selectRootRoute, selectSignedOutReason } from "../selectors";
import type { SessionState } from "../state";

const STATES: Readonly<Record<string, SessionState>> = {
	starting: { status: "starting" },
	signedOut: { status: "signedOut", reason: "sessionExpired" },
	locked: { status: "locked" },
	full: { status: "signedIn", session: { scope: "full" } },
	restricted: { status: "signedIn", session: { scope: "restricted", enrollmentReason: "email_verification" } },
	restrictedToTwoFactor: { status: "signedIn", session: { scope: "restricted", enrollmentReason: "mfa_enrollment" } },
	upgrade: { status: "upgradeRequired", minimumVersion: "2.0.0" },
};

describe("selectRootRoute — the route table of §9.6", () => {
	it.each([
		["starting", "starting"],
		["signedOut", "auth"],
		["locked", "lock"],
		["full", "app"],
		["restricted", "verify-email"],
		["restrictedToTwoFactor", "enroll-two-factor"],
		["upgrade", "update-required"],
	])("%s → %s", (state, route) => {
		expect(selectRootRoute(STATES[state] ?? { status: "starting" })).toBe(route);
	});
});

describe("session selectors", () => {
	it("reads the sign-out reason and the minimum version", () => {
		expect(selectSignedOutReason(STATES.signedOut ?? { status: "starting" })).toBe("sessionExpired");
		expect(selectSignedOutReason(STATES.locked ?? { status: "starting" })).toBeNull();
		expect(selectMinimumVersion(STATES.upgrade ?? { status: "starting" })).toBe("2.0.0");
		expect(selectMinimumVersion(STATES.full ?? { status: "starting" })).toBeNull();
	});

	it.each([
		["starting", false],
		["signedOut", false],
		["locked", false],
		["full", true],
		["restricted", true],
		["upgrade", false],
	])("lets the refresh token be read in %s: %s", (state, allowed) => {
		expect(selectCanReadRefreshToken(STATES[state] ?? { status: "starting" })).toBe(allowed);
	});
});
