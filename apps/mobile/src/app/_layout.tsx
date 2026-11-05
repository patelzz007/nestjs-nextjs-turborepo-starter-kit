// ============================================
// _layout.tsx - the root layout: stylesheet, app runtime, root guard (§9.4, §9.6)
// ============================================
// The Uniwind stylesheet is imported HERE (ADR 032), never in the entry file.
// `KeyboardProvider` wraps everything, the configuration-error screen
// included: every keyboard-avoiding view (components/keyboard-avoiding-view.tsx)
// reads the keyboard from it, in the app's window and in every sheet's.
//
// The app draws edge to edge; what the provider is told about the system bars, and why it differs
// between Expo Go and a build, is in lib/keyboard-system-bars.
//
// `UrlStateProvider` is the URL-state engine (lib/url-state: nuqs on Expo Router), mounted once for
// every screen.

import "../../global.css";

import type { ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";

import { AppCrashScreen } from "../components/app-crash-screen";
import { startCrashReporting } from "../lib/crash-reporting/start-crash-reporting";
import { useAppFonts } from "../lib/fonts";
import { KEYBOARD_SYSTEM_BARS } from "../lib/keyboard-system-bars";
import { UrlStateProvider } from "../lib/url-state/url-state-provider";
import { createDeviceAppRuntime } from "../runtime/device-runtime";
import { AppShell } from "../runtime/app-shell";
import { RootStack } from "../runtime/root-navigator";
import { ConfigIssueProvider } from "../runtime/runtime-context";

// Keep the splash screen up until the preferences (theme) and the session are restored.
SplashScreen.preventAutoHideAsync().catch((): void => {
	// Already prevented (fast refresh in development).
});

// Crash reporting starts first, so even a failure while the app starts is reported (enhancement 6.2).
// Development builds collect nothing.
void startCrashReporting(!__DEV__, (message: string, error: Error): void => {
	console.warn(message, error);
});

/**
 * A screen that throws while rendering shows the crash screen instead of a blank app (Expo Router's boundary).
 * It replaces the whole tree, providers included, so it brings a safe-area provider seeded with the window's
 * starting metrics (an unseeded one draws nothing until it has measured).
 */
export function ErrorBoundary(props: ErrorBoundaryProps): React.JSX.Element {
	return (
		<SafeAreaProvider initialMetrics={initialWindowMetrics}>
			<AppCrashScreen {...props} />
		</SafeAreaProvider>
	);
}

export default function RootLayout(): React.JSX.Element | null {
	const [runtime] = React.useState(createDeviceAppRuntime);
	// The typefaces load while the app runtime starts; the splash screen waits for both (ADR 037).
	const fontsReady = useAppFonts();

	React.useEffect((): void => {
		if (runtime.kind === "configError" && fontsReady) {
			SplashScreen.hideAsync().catch((): void => {
				// Already hidden.
			});
		}
	}, [fontsReady, runtime.kind]);

	if (runtime.kind === "configError") {
		if (!fontsReady) {
			return null;
		}
		return (
			<KeyboardProvider {...KEYBOARD_SYSTEM_BARS}>
				<ConfigIssueProvider issue={runtime.issue}>
					<RootStack route="config-error" />
				</ConfigIssueProvider>
			</KeyboardProvider>
		);
	}
	return (
		<KeyboardProvider {...KEYBOARD_SYSTEM_BARS}>
			<UrlStateProvider>
				<AppShell runtime={runtime} fontsReady={fontsReady} />
			</UrlStateProvider>
		</KeyboardProvider>
	);
}
