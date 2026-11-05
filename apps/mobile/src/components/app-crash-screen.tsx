// ============================================
// The app's last-resort error screen (enhancement 6.2)
// ============================================
// Expo Router shows it in place of the app when a screen throws while rendering (the root
// layout's `ErrorBoundary`). It reports the error once and offers to try again. It sits
// outside the app's providers and navigator: the boundary gives it a safe-area provider of
// its own, and it draws with plain views.

import type { ErrorBoundaryProps } from "expo-router";
import * as React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { Button } from "@workspace/ui-native/components/button";
import { Heading, MutedText } from "@workspace/ui-native/components/text";

import { reportError } from "../lib/crash-reporting/crash-reporter";

/** What the screen says under its heading. */
const CRASH_MESSAGE = "This screen hit a problem it couldn't recover from. Try again; if it keeps happening, close the app and open it again.";

/** react-native-safe-area-context's view, with Uniwind's `className` (as the auth shell uses it). */
const StyledSafeAreaView = withUniwind(SafeAreaView);

export function AppCrashScreen({ error, retry }: ErrorBoundaryProps): React.JSX.Element {
	React.useEffect((): void => {
		reportError(error, "screen");
	}, [error]);
	const tryAgain = React.useCallback((): void => {
		void retry();
	}, [retry]);
	// Plain views only: the boundary sits outside the navigator, and the app's `Screen` needs one.
	return (
		<StyledSafeAreaView edges={["top", "bottom"]} className="flex-1 justify-center gap-4 bg-background px-6" testID="app-crash-screen">
			<Heading>Something went wrong</Heading>
			<MutedText>{CRASH_MESSAGE}</MutedText>
			<Button label="Try again" onPress={tryAgain} />
		</StyledSafeAreaView>
	);
}
