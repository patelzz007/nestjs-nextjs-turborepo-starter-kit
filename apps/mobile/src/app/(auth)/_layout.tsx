// The (auth) group: a stack inside the AuthShell (ADR 039) — the brand on the
// auth panel, and a sheet that holds each screen's form. A signed-out device
// sees the sign-in screens; a RESTRICTED session (§10.5, forced enrollment)
// sees only the step it must finish. Screens render only their form (AuthPage).

import { Stack, ThemeProvider } from "expo-router";
import * as React from "react";

import { AuthShell } from "../../components/auth-shell";
import { useEnrollmentReason } from "../../features/session/facade";
import { PUSH_TRANSITION } from "../../lib/screen-transitions";
import { useKeyboardVisible } from "../../lib/use-keyboard-visible";
import { useNavigationTheme, type NavigationTheme } from "../../runtime/navigation-theme";
import { useReadyRuntime } from "../../runtime/runtime-context";

/** Under the brand name, while there is room for it. */
const AUTH_TAGLINE = "Sign in to pick up where you left off.";

const SCREEN_OPTIONS = { headerShown: false, animation: PUSH_TRANSITION } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

export default function AuthLayout(): React.JSX.Element {
	const enrollmentReason = useEnrollmentReason();
	const { appName } = useReadyRuntime();
	const keyboardVisible = useKeyboardVisible();
	// The screens sit on the card-coloured sheet: a push must reveal card, not the page colour, behind them.
	const navigationTheme = useNavigationTheme();
	const sheetTheme = React.useMemo(
		(): NavigationTheme => ({ ...navigationTheme, colors: { ...navigationTheme.colors, background: navigationTheme.colors.card } }),
		[navigationTheme],
	);
	return (
		<AuthShell brandName={appName} tagline={AUTH_TAGLINE} compact={keyboardVisible} testID="auth-shell">
			<ThemeProvider value={sheetTheme}>
				<Stack screenOptions={SCREEN_OPTIONS}>
					<Stack.Protected guard={enrollmentReason === null}>
						<Stack.Screen name="sign-in" />
						<Stack.Screen name="sign-up" />
						<Stack.Screen name="forgot-password" />
						<Stack.Screen name="two-factor" />
						<Stack.Screen name="verify-device" />
					</Stack.Protected>
					<Stack.Protected guard={enrollmentReason === "mfa_enrollment"}>
						<Stack.Screen name="enroll-two-factor" />
					</Stack.Protected>
					<Stack.Protected guard={enrollmentReason === "email_verification"}>
						<Stack.Screen name="verify-email" />
					</Stack.Protected>
				</Stack>
			</ThemeProvider>
		</AuthShell>
	);
}
