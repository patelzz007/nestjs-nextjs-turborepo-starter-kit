// ============================================
// root-route.ts — the route group the app shows (the root guard's input)
// ============================================
// The session decides the group (features/session/selectors.ts) — except that
// a signed-out device that has never been through onboarding sees onboarding
// first (ADR 041). Onboarding never interrupts a signed-in, locked or
// restricted session, or the configuration and update screens.

import type { RootRoute } from "../features/session/selectors";

export type AppRootRoute = RootRoute | "onboarding";

export interface RootRouteInputs {
	/** The group the session allows. */
	readonly sessionRoute: RootRoute;
	/** The session is signed out (not merely restricted to an enrollment step). */
	readonly isSignedOut: boolean;
	readonly onboardingCompleted: boolean;
}

export function resolveRootRoute({ sessionRoute, isSignedOut, onboardingCompleted }: RootRouteInputs): AppRootRoute {
	return isSignedOut && !onboardingCompleted ? "onboarding" : sessionRoute;
}
