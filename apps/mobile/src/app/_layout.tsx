// ============================================
// _layout.tsx - the root layout: stylesheet, app runtime, root guard (§9.4, §9.6)
// ============================================
// The Uniwind stylesheet is imported HERE (ADR 032), never in the entry file.

import "../../global.css";

import * as SplashScreen from "expo-splash-screen";
import * as React from "react";

import { useAppFonts } from "../lib/fonts";
import { createDeviceAppRuntime } from "../runtime/device-runtime";
import { AppShell } from "../runtime/app-shell";
import { RootStack } from "../runtime/root-navigator";
import { ConfigIssueProvider } from "../runtime/runtime-context";

// Keep the splash screen up until the preferences (theme) and the session are restored.
SplashScreen.preventAutoHideAsync().catch((): void => {
	// Already prevented (fast refresh in development).
});

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
			<ConfigIssueProvider issue={runtime.issue}>
				<RootStack route="config-error" />
			</ConfigIssueProvider>
		);
	}
	return <AppShell runtime={runtime} fontsReady={fontsReady} />;
}
