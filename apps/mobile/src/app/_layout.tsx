// ============================================
// _layout.tsx - the root layout: stylesheet, app runtime, root guard (§9.4, §9.6)
// ============================================
// The Uniwind stylesheet is imported HERE (ADR 032), never in the entry file.

import "../../global.css";

import * as SplashScreen from "expo-splash-screen";
import * as React from "react";

import { createDeviceAppRuntime } from "../runtime/device-runtime";
import { AppShell } from "../runtime/app-shell";
import { RootStack } from "../runtime/root-navigator";
import { ConfigIssueProvider } from "../runtime/runtime-context";

// Keep the splash screen up until the preferences (theme) and the session are restored.
SplashScreen.preventAutoHideAsync().catch((): void => {
	// Already prevented (fast refresh in development).
});

export default function RootLayout(): React.JSX.Element {
	const [runtime] = React.useState(createDeviceAppRuntime);

	React.useEffect((): void => {
		if (runtime.kind === "configError") {
			SplashScreen.hideAsync().catch((): void => {
				// Already hidden.
			});
		}
	}, [runtime.kind]);

	if (runtime.kind === "configError") {
		return (
			<ConfigIssueProvider issue={runtime.issue}>
				<RootStack route="config-error" />
			</ConfigIssueProvider>
		);
	}
	return <AppShell runtime={runtime} />;
}
