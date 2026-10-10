// ============================================
// app-shell.tsx - the providers and the guarded navigator of a ready app (§9.4)
// ============================================

import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as React from "react";

import { LaunchScreen } from "../components/launch-screen";
import { PrivacyCover } from "../components/privacy-cover";
import { useAppLockLifecycle } from "../features/app-lock/use-app-lock-lifecycle";
import { loadPreferences } from "../features/preferences/persistence";
import { PreferencesStoreProvider, useOnboardingCompleted } from "../features/preferences/facade";
import { SessionStoreProvider, useRootRoute, useSessionCommands, useSignedOutReason } from "../features/session/facade";
import { ApiClientProvider } from "../lib/api-context";
import { startAppRuntime, type ReadyAppRuntime } from "./app-runtime";
import { NavigationThemeProvider } from "./navigation-theme";
import { RootStack } from "./root-navigator";
import { resolveRootRoute } from "./root-route";
import { ReadyRuntimeProvider } from "./runtime-context";

/** The line under the app's name on the launch screen. Products change it (ADR 043). */
const LAUNCH_TAGLINE = "Your account, wherever you are.";

export interface AppShellProps {
	readonly runtime: ReadyAppRuntime;
	/** The typefaces are loaded (or failed to, falling back to the system font): the splash screen waits for it. */
	readonly fontsReady: boolean;
}

/** Root providers, in the order of §9.4: API client, query client, session store, preferences store. */
export function AppShell({ runtime, fontsReady }: AppShellProps): React.JSX.Element {
	return (
		<ReadyRuntimeProvider runtime={runtime}>
			<ApiClientProvider client={runtime.apiClient}>
				<QueryClientProvider client={runtime.queryClient}>
					<SessionStoreProvider store={runtime.sessionStore}>
						<PreferencesStoreProvider store={runtime.preferencesStore}>
							<GuardedNavigator runtime={runtime} fontsReady={fontsReady} />
						</PreferencesStoreProvider>
					</SessionStoreProvider>
				</QueryClientProvider>
			</ApiClientProvider>
		</ReadyRuntimeProvider>
	);
}

function GuardedNavigator({ runtime, fontsReady }: AppShellProps): React.JSX.Element | null {
	const sessionRoute = useRootRoute();
	const isSignedOut = useSignedOutReason() !== null;
	const onboardingCompleted = useOnboardingCompleted();
	const route = resolveRootRoute({ sessionRoute, isSignedOut, onboardingCompleted });
	const session = useSessionCommands();
	const { isCoverVisible } = useAppLockLifecycle({ resetAppLock: runtime.resetAppLock });

	React.useEffect((): void => {
		startAppRuntime(runtime, loadPreferences).catch((): void => {
			// Nothing on the device could be read: start signed out rather than stay on the splash screen.
			session.signedOut("none");
		});
	}, [runtime, session]);

	const isRestoring = route === "starting";
	// The native splash hands over to the in-app LaunchScreen as soon as the typefaces can draw it (ADR 043).
	React.useEffect((): void => {
		if (fontsReady) {
			SplashScreen.hideAsync().catch((): void => {
				// The splash screen was already hidden (fast refresh in development).
			});
		}
	}, [fontsReady]);

	if (!fontsReady) {
		// The native splash stays up until the launch screen can be drawn in the brand typefaces.
		return null;
	}
	return (
		<>
			{isRestoring ? null : (
				<NavigationThemeProvider>
					<StatusBar style="auto" />
					<RootStack route={route} />
				</NavigationThemeProvider>
			)}
			{/* Until the session is restored and the theme applied (§9.4); fades out over the first screen. */}
			{isRestoring ? <LaunchScreen title={runtime.appName} tagline={LAUNCH_TAGLINE} testID="launch-screen" /> : null}
			<PrivacyCover visible={isCoverVisible} appName={runtime.appName} />
		</>
	);
}
