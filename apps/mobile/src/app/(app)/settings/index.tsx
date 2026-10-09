// ============================================
// Settings (§10.9) — appearance, security, devices, app lock, about, sign out
// ============================================

import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { DetailList, type DetailItem } from "../../../components/detail-list";
import { ListRow } from "../../../components/list-row";
import { Screen } from "../../../components/screen";
import { useSignOut } from "../../../features/auth/use-sign-out";
import { useAppLockEnabled, useThemePreference } from "../../../features/preferences/facade";
import { THEME_LABELS } from "../../../features/preferences/labels";
import { ROUTES } from "../../../runtime/routes";
import { useReadyRuntime } from "../../../runtime/runtime-context";

export default function SettingsScreen(): React.JSX.Element {
	const router = useRouter();
	const { appVersion, buildNumber, env } = useReadyRuntime();
	const theme = useThemePreference();
	const appLockEnabled = useAppLockEnabled();
	const { signOut } = useSignOut();
	const [isSignOutOpen, setSignOutOpen] = React.useState(false);
	const [isSigningOut, setSigningOut] = React.useState(false);

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
	const askSignOut = React.useCallback((): void => {
		setSignOutOpen(true);
	}, []);
	const cancelSignOut = React.useCallback((): void => {
		setSignOutOpen(false);
	}, []);
	const confirmSignOut = React.useCallback((): void => {
		setSigningOut(true);
		// The device leaves whatever the API answers; the root guard then shows sign-in.
		signOut().catch((): void => {
			setSigningOut(false);
		});
	}, [signOut]);

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
			</Card>
			<Button label="Sign out" variant="secondary" onPress={askSignOut} />
			<ConfirmDialog
				visible={isSignOutOpen}
				title="Sign out?"
				description="You'll need your password to sign in again on this device."
				confirmLabel="Sign out"
				cancelLabel="Cancel"
				onConfirm={confirmSignOut}
				onCancel={cancelSignOut}
				pending={isSigningOut}
				destructive
			/>
		</Screen>
	);
}
