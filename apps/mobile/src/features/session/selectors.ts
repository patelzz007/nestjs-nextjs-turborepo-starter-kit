import type { EnrollmentReason } from "@workspace/shared";

import type { SessionState, SignedOutReason } from "./state";

/** The route groups of the root guard (§9.6). `config-error` is chosen before the session exists. */
export type RootRoute = "starting" | "config-error" | "update-required" | "auth" | "enroll-two-factor" | "verify-email" | "lock" | "app";

/** The one screen a restricted session may see: the enrollment step it must finish. */
const ENROLLMENT_ROUTES = {
	mfa_enrollment: "enroll-two-factor",
	email_verification: "verify-email",
} satisfies Record<EnrollmentReason, RootRoute>;

/** Which route group the session allows — exactly one at a time. */
export function selectRootRoute(state: SessionState): RootRoute {
	switch (state.status) {
		case "starting":
			return "starting";
		case "upgradeRequired":
			return "update-required";
		case "locked":
			return "lock";
		case "signedOut":
			return "auth";
		case "signedIn":
			// A restricted session may only finish its enrollment step.
			return state.session.scope === "full" ? "app" : ENROLLMENT_ROUTES[state.session.enrollmentReason];
	}
}

/** Why the device is signed out, for the sign-in screen's notice. */
export function selectSignedOutReason(state: SessionState): SignedOutReason | null {
	return state.status === "signedOut" ? state.reason : null;
}

/** The minimum version the API asked for, when the update screen shows. */
export function selectMinimumVersion(state: SessionState): string | null {
	return state.status === "upgradeRequired" ? state.minimumVersion : null;
}

/**
 * The refresh token may be read only by a signed-in, unlocked app (§11.2):
 * never while starting (the lock is not decided yet) or locked.
 */
export function selectCanReadRefreshToken(state: SessionState): boolean {
	return state.status === "signedIn";
}
