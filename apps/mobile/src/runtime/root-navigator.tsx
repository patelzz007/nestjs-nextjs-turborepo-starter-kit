// ============================================
// root-navigator.tsx - the root guard (docs/technical/mobile/mobile-app.md §9.6)
// ============================================
// Exactly ONE route group is reachable per session state; Expo Router's
// protected screens redirect away from every other one. Screens never decide
// where to go after authentication — they report what happened to the session
// store, and this guard moves the app.
//
// | State           | Routes allowed                 |
// | ConfigError     | config-error only              |
// | UpgradeRequired | update-required only           |
// | SignedOut       | onboarding only, until it is done (ADR 041); then (auth) only |
// | Locked          | lock only                      |
// | SignedIn        | (app) only ((auth) enrollment screens while the session is restricted) |

import { Stack } from "expo-router";
import * as React from "react";

import { ROOT_TRANSITION } from "../lib/screen-transitions";
import type { AppRootRoute } from "./root-route";
import { ROUTES, type AppRoute } from "./routes";

export interface RootStackProps {
	readonly route: Exclude<AppRootRoute, "starting">;
}

const SCREEN_OPTIONS = { headerShown: false, animation: ROOT_TRANSITION } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

/**
 * The screen each state opens on. A guard that turns a URL away sends it here,
 * explicitly: Expo Router's own fallback is the first allowed group's path, and
 * for the pathless (auth) group that is `/` — a URL it has no screen for, so the
 * signed-out app showed "Unmatched Route". Inside (auth), a restricted session's
 * guards turn `/sign-in` away in turn, to the enrollment step it must finish.
 */
const ROOT_ROUTE_ENTRY = {
	"config-error": ROUTES.configError,
	"update-required": ROUTES.updateRequired,
	lock: ROUTES.lock,
	onboarding: ROUTES.onboarding,
	auth: ROUTES.signIn,
	app: ROUTES.home,
} satisfies Record<RootStackProps["route"], AppRoute>;

/** The navigator with every group guarded by the current root route. */
export function RootStack({ route }: RootStackProps): React.JSX.Element {
	const entry = ROOT_ROUTE_ENTRY[route];
	return (
		<Stack screenOptions={SCREEN_OPTIONS}>
			<Stack.Protected redirectTo={entry} guard={route === "config-error"}>
				<Stack.Screen name="config-error" />
			</Stack.Protected>
			<Stack.Protected redirectTo={entry} guard={route === "update-required"}>
				<Stack.Screen name="update-required" options={{ gestureEnabled: false }} />
			</Stack.Protected>
			<Stack.Protected redirectTo={entry} guard={route === "lock"}>
				<Stack.Screen name="lock" options={{ gestureEnabled: false }} />
			</Stack.Protected>
			<Stack.Protected redirectTo={entry} guard={route === "onboarding"}>
				<Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
			</Stack.Protected>
			<Stack.Protected redirectTo={entry} guard={route === "auth"}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
			<Stack.Protected redirectTo={entry} guard={route === "app"}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
		</Stack>
	);
}
