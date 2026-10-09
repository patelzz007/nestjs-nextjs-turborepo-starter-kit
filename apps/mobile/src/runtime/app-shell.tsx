// ============================================
// app-shell.tsx - the providers and the guarded navigator of a ready app (§9.4)
// ============================================

import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as React from "react";

import { PrivacyCover } from "../components/privacy-cover";
import { useAppLockLifecycle } from "../features/app-lock/use-app-lock-lifecycle";
import { loadPreferences } from "../features/preferences/persistence";
import { PreferencesStoreProvider } from "../features/preferences/facade";
import { SessionStoreProvider, useRootRoute, useSessionCommands } from "../features/session/facade";
import { ApiClientProvider } from "../lib/api-context";
import { startAppRuntime, type ReadyAppRuntime } from "./app-runtime";
import { RootStack } from "./root-navigator";
import { ReadyRuntimeProvider } from "./runtime-context";

export interface AppShellProps {
	readonly runtime: ReadyAppRuntime;
}

/** Root providers, in the order of §9.4: API client, query client, session store, preferences store. */
export function AppShell({ runtime }: AppShellProps): React.JSX.Element {
	return (
		<ReadyRuntimeProvider runtime={runtime}>
			<ApiClientProvider client={runtime.apiClient}>
				<QueryClientProvider client={runtime.queryClient}>
					<SessionStoreProvider store={runtime.sessionStore}>
						<PreferencesStoreProvider store={runtime.preferencesStore}>
							<GuardedNavigator runtime={runtime} />
						</PreferencesStoreProvider>
					</SessionStoreProvider>
				</QueryClientProvider>
			</ApiClientProvider>
		</ReadyRuntimeProvider>
	);
}

function GuardedNavigator({ runtime }: AppShellProps): React.JSX.Element | null {
	const route = useRootRoute();
	const session = useSessionCommands();
	const { isCoverVisible } = useAppLockLifecycle({ resetAppLock: runtime.resetAppLock });

	React.useEffect((): void => {
		startAppRuntime(runtime, loadPreferences).catch((): void => {
			// Nothing on the device could be read: start signed out rather than stay on the splash screen.
			session.signedOut("none");
		});
	}, [runtime, session]);

	const isStarting = route === "starting";
	React.useEffect((): void => {
		if (!isStarting) {
			SplashScreen.hideAsync().catch((): void => {
				// The splash screen was already hidden (fast refresh in development).
			});
		}
	}, [isStarting]);

	if (route === "starting") {
		// The splash screen stays up: the theme is applied before the first frame (§9.4).
		return null;
	}
	return (
		<>
			<StatusBar style="auto" />
			<RootStack route={route} />
			<PrivacyCover visible={isCoverVisible} appName={runtime.appName} />
		</>
	);
}
