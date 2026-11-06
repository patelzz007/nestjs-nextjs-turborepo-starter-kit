// The auth/(forms) group (`/auth/sign-in`, …): a stack inside the AuthShell (ADR 039) — the brand on
// the auth panel, and a sheet that holds each screen's form. A signed-out device sees the sign-in
// screens; a RESTRICTED session (§10.5, forced enrollment) sees only the step it must finish. Each
// screen is gated to the root route it belongs to (runtime/root-navigator, `withRootGate`): no
// protected screens here, and no list of screens (runtime/root-navigator says why). Screens render only their form (AuthPage).

import { Stack, ThemeProvider } from "expo-router";
import * as React from "react";

import { AuthShell } from "../../../components/auth-shell";
import { useBuildInfo } from "../../../features/build-info/use-build-info";
import { PUSH_TRANSITION } from "../../../lib/screen-transitions";
import { useKeyboardVisible } from "../../../lib/use-keyboard-visible";
import { useNavigationTheme, type NavigationTheme } from "../../../runtime/navigation-theme";
import { withRootGate } from "../../../runtime/root-navigator";
import { useReadyRuntime } from "../../../runtime/runtime-context";

/** Under the brand name, while there is room for it. */
const AUTH_TAGLINE = "Sign in to pick up where you left off.";

/**
 * `freezeOnBlur`: a screen out of sight (under the one on top, or in another tab) does not re-render
 * until it is shown again. A theme change then restyles only what is on screen at once (6.7).
 */
const SCREEN_OPTIONS = { headerShown: false, animation: PUSH_TRANSITION, freezeOnBlur: true } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

function AuthLayout(): React.JSX.Element {
	const { appName } = useReadyRuntime();
	const keyboardVisible = useKeyboardVisible();
	const buildInfo = useBuildInfo();
	const buildLines = buildInfo.moment === null ? [buildInfo.summary] : [buildInfo.summary, buildInfo.moment.line];
	const navigationTheme = useNavigationTheme();
	const sheetTheme = React.useMemo(
		(): NavigationTheme => ({ ...navigationTheme, colors: { ...navigationTheme.colors, background: navigationTheme.colors.card } }),
		[navigationTheme],
	);
	return (
		<AuthShell brandName={appName} tagline={AUTH_TAGLINE} buildLines={buildLines} compact={keyboardVisible} testID="auth-shell">
			<ThemeProvider value={sheetTheme}>
				<Stack screenOptions={SCREEN_OPTIONS} />
			</ThemeProvider>
		</AuthShell>
	);
}

export default withRootGate(["auth", "enroll-two-factor", "verify-email"], AuthLayout);
