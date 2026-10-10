// ============================================
// Settings (§10.9) — appearance, security, devices, app lock, about, sign out
// ============================================

import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { DetailList, type DetailItem } from "../../../components/detail-list";
import { ListRow } from "../../../components/list-row";
import { Screen } from "../../../components/screen";
import { SignOutDialog } from "../../../features/auth/sign-out-dialog";
import { useSignOut } from "../../../features/auth/use-sign-out";
import { useSignOutConfirmation } from "../../../features/auth/use-sign-out-confirmation";
import { useAppLockEnabled, usePreferencesCommands, useThemePreference } from "../../../features/preferences/facade";
import { THEME_LABELS } from "../../../features/preferences/labels";
import { ROUTES } from "../../../runtime/routes";
import { useReadyRuntime } from "../../../runtime/runtime-context";

export default function SettingsScreen(): React.JSX.Element {
	const router = useRouter();
	const { appVersion, buildNumber, env } = useReadyRuntime();
	const theme = useThemePreference();
	const appLockEnabled = useAppLockEnabled();
	const signOut = useSignOutConfirmation();
	const preferences = usePreferencesCommands();
	const { signOut: signOutNow } = useSignOut();

	const openAppearance = React.useCallback((): void => {
		router.push(ROUTES.appearance);
	}, [router]);
	const openSecurity = React.useCallback((): void => {
		router.push(ROUTES.security);
	}, [router]);
	const openDevices = React.useCallback((): void => {
		router.push(ROUTES.devices);
	}, [router]);
	const openAppLock = React.useCallback((): void => {
		router.push(ROUTES.appLock);
	}, [router]);

	/** Development builds only: onboarding's "seen" flag lives in the Keychain, which outlives reinstalls (ADR 041). */
	const replayOnboarding = React.useCallback((): void => {
		preferences.onboardingReset();
		void signOutNow();
	}, [preferences, signOutNow]);

	const about: DetailItem[] = [{ label: "Version", value: appVersion }];
	if (buildNumber !== null) {
		about.push({ label: "Build", value: buildNumber });
	}
	if (env.isDevelopment) {
		about.push({ label: "API address", value: env.apiBaseUrl });
	}

	return (
		<Screen title="Settings">
			<Card>
				<View>
					<ListRow label="Appearance" value={THEME_LABELS[theme]} onPress={openAppearance} />
					<ListRow label="Security" description="Password, two-factor authentication, backup codes" onPress={openSecurity} />
					<ListRow label="Signed-in devices" onPress={openDevices} />
					<ListRow label="App lock" value={appLockEnabled ? "On" : "Off"} onPress={openAppLock} />
				</View>
			</Card>
			<Card title="About">
				<DetailList items={about} />
				{env.isDevelopment ? (
					<Button
						label="Sign out and replay onboarding"
						variant="secondary"
						onPress={replayOnboarding}
						accessibilityHint="Development builds only: shows the first-launch walkthrough again"
					/>
				) : null}
			</Card>
			<Button label="Sign out" onPress={signOut.ask} />
			<SignOutDialog confirmation={signOut} />
		</Screen>
	);
}
