// The auth folder: every screen in front of the auth wall, at `/auth/…`. A stack of two:
//
// | Screen       | URL                    | What it is                                                              |
// | onboarding   | /auth/onboarding       | the first-launch walkthrough (ADR 041), full screen                    |
// | (forms)      | /auth/sign-in, …       | the sign-in screens and the enrollment steps, framed by the AuthShell   |
//
// `(forms)` is a group (no segment of its own), so the AuthShell frames the forms and not the
// walkthrough. The folder is gated to every root route it serves (runtime/root-navigator,
// `withRootGate`); each screen in it is gated to its own. No protected screens.

import { Stack } from "expo-router";
import * as React from "react";

import { rootScreenOptionsOf, withRootGate } from "../../runtime/root-navigator";

function AuthFolderLayout(): React.JSX.Element {
	return <Stack screenOptions={rootScreenOptionsOf} />;
}

export default withRootGate(["onboarding", "auth", "enroll-two-factor", "verify-email"], AuthFolderLayout);
