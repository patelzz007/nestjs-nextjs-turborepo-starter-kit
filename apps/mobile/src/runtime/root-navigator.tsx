// ============================================
// root-navigator.tsx - the root guard (docs/technical/mobile/mobile-app.md §9.6)
// ============================================
// Exactly ONE root screen is reachable per session state. Screens never decide
// where to go after authentication — they report what happened to the session
// store, and this guard moves the app.
//
// | State           | Root screen                    |
// | ConfigError     | config-error                   |
// | UpgradeRequired | update-required                |
// | SignedOut       | auth/onboarding, until it is done (ADR 041); then auth/sign-in |
// | Locked          | lock                           |
// | Restricted      | auth/enroll-two-factor or auth/verify-email (the step it must finish) |
// | SignedIn        | (app)                          |
//
// The root stack always declares every root screen, and every route file is wrapped in
// `withRootGate`: shown while the session's root route is one it belongs to, otherwise replaced
// by a redirect to the screen that route opens on. The auth folder (`/auth/…`) serves four routes —
// onboarding, signed out and the two enrollment steps — and each of its screens is gated to its own. Expo Router's protected screens
// (`Stack.Protected`) are not used: their guards change the navigator's screen list with the
// session (each change a ROUTE_NAMES_CHANGED action, unhandled when it lands on a navigator
// that is leaving), and a nested stack's guards re-ran their route clean-up on every render
// of a redirected route, a loop React stopped as "Maximum update depth exceeded"
// (seen on a phone whose session had ended while the app was closed).

import { Redirect, Stack } from "expo-router";
import * as React from "react";

import { ROOT_TRANSITION } from "../lib/screen-transitions";
import type { AppRootRoute } from "./root-route";
import { ROUTES, type AppRoute } from "./routes";

/** A root route with a screen (`starting` shows the launch screen instead of the navigator). */
export type GatedRootRoute = Exclude<AppRootRoute, "starting">;

export interface RootStackProps {
	readonly route: GatedRootRoute;
}

/** A root-level stack: no header, screens fade in and out (the auth folder's stack uses it too). */
export const ROOT_SCREEN_OPTIONS = { headerShown: false, animation: ROOT_TRANSITION } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

/** A root screen the person may not swipe away from: there is nothing behind it to go back to. */
export const PINNED = { gestureEnabled: false } satisfies React.ComponentProps<typeof Stack.Screen>["options"];

/**
 * The screen each root route opens on, where a root screen of another route redirects.
 * Explicit: the auth folder has no screen at `/auth`.
 */
export const ROOT_ROUTE_ENTRY = {
	"config-error": ROUTES.configError,
	"update-required": ROUTES.updateRequired,
	lock: ROUTES.lock,
	onboarding: ROUTES.onboarding,
	auth: ROUTES.signIn,
	"enroll-two-factor": ROUTES.enrollTwoFactor,
	"verify-email": ROUTES.verifyEmail,
	app: ROUTES.home,
} satisfies Record<GatedRootRoute, AppRoute>;

const RootRouteContext = React.createContext<GatedRootRoute | null>(null);

/** The root navigator: every root screen, the session's root route for their gates. */
export function RootStack({ route }: RootStackProps): React.JSX.Element {
	return (
		<RootRouteContext value={route}>
			<Stack screenOptions={ROOT_SCREEN_OPTIONS}>
				<Stack.Screen name="config-error" />
				<Stack.Screen name="update-required" options={PINNED} />
				<Stack.Screen name="lock" options={PINNED} />
				<Stack.Screen name="auth" />
				<Stack.Screen name="(app)" />
			</Stack>
		</RootRouteContext>
	);
}

/**
 * `Screen` (a route file's screen or layout, which take no props), a root screen of `owners`: shown while the session's root route is one of them, otherwise a redirect to
 * the screen the current route opens on. Outside a {@link RootStack} (a screen rendered on its own) there is no
 * root route, and the screen is shown.
 */
export function withRootGate(owners: readonly GatedRootRoute[], Screen: () => React.JSX.Element): () => React.JSX.Element {
	function GatedRootScreen(): React.JSX.Element {
		const route = React.use(RootRouteContext);
		if (route !== null && !owners.includes(route)) {
			return <Redirect href={ROOT_ROUTE_ENTRY[route]} />;
		}
		return <Screen />;
	}
	return GatedRootScreen;
}
