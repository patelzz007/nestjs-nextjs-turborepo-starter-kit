// ============================================
// Settings (§10.9) — appearance, language, security, devices, app lock, about, sign out
// ============================================

import FileTextIcon from "lucide-react-native/icons/file-text";
import LanguagesIcon from "lucide-react-native/icons/languages";
import LockKeyholeIcon from "lucide-react-native/icons/lock-keyhole";
import PaletteIcon from "lucide-react-native/icons/palette";
import ScanQrCodeIcon from "lucide-react-native/icons/scan-qr-code";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { ListGroup } from "@workspace/ui-native/components/list-group";
import { ListRow } from "@workspace/ui-native/components/list-row";
import { Screen } from "../../../components/screen";
import { SignOutDialog, useSignOut, useSignOutConfirmation } from "../../../contexts/identity";
import { useAppLockEnabled, usePreferencesCommands, useThemePreference } from "../../../features/preferences/facade";
import { PREFERENCES_LABELS } from "../../../features/preferences/labels";
import { APP_LANGUAGE_NAMES } from "../../../features/language/app-languages";
import { useAppLanguage, useLabels } from "../../../features/language/use-app-language";
import { BUILD_INFO_LABELS } from "../../../features/build-info/labels";
import { useBuildInfo } from "../../../features/build-info/use-build-info";
import { NAVIGATION_LABELS } from "../../../features/navigation/navigation-labels";
import { canReplayOnboarding } from "../../../lib/env";
import { ROUTES } from "../../../runtime/routes";
import { useReadyRuntime } from "../../../runtime/runtime-context";

export default function SettingsScreen(): React.JSX.Element {
	const router = useRouter();
	const { appVersion, buildNumber, env } = useReadyRuntime();
	const theme = useThemePreference();
	const appLockEnabled = useAppLockEnabled();
	const language = useAppLanguage();
	const { headings, sections, settings: labels } = useLabels(NAVIGATION_LABELS);
	const { themes } = useLabels(PREFERENCES_LABELS);
	const buildInfo = useBuildInfo();
	const { buildType } = useLabels(BUILD_INFO_LABELS);
	const signOut = useSignOutConfirmation();
	const preferences = usePreferencesCommands();
	const { signOut: signOutNow } = useSignOut();

	const openAppearance = React.useCallback((): void => {
		router.push(ROUTES.appearance);
	}, [router]);
	const openLanguage = React.useCallback((): void => {
		router.push(ROUTES.language);
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
	const openTill = React.useCallback((): void => {
		router.push(ROUTES.till);
	}, [router]);
	const openPdfViewer = React.useCallback((): void => {
		router.push(ROUTES.pdfViewer);
	}, [router]);

	/** Development and test builds only (`canReplayOnboarding`): onboarding's "seen" flag lives in the Keychain, which outlives reinstalls (ADR 041). */
	const replayOnboarding = React.useCallback((): void => {
		preferences.onboardingReset();
		void signOutNow();
	}, [preferences, signOutNow]);

	const about: DetailItem[] = [
		{ label: buildType, value: buildInfo.kindLabel },
		{ label: labels.version, value: appVersion },
	];
	if (buildNumber !== null) {
		about.push({ label: labels.build, value: buildNumber });
	}
	if (buildInfo.moment !== null) {
		about.push({ label: buildInfo.moment.word, value: buildInfo.moment.when });
	}
	if (env.isDevelopment) {
		about.push({ label: labels.apiAddress, value: env.apiBaseUrl });
	}

	return (
		<Screen>
			{/* Grouped as the drawer groups them (drawer-destinations.ts), with the drawer's glyphs, so the two never disagree. */}
			<ListGroup title={sections.preferences}>
				<ListRow icon={PaletteIcon} label={headings.appearance.title} value={themes[theme]} onPress={openAppearance} />
				<ListRow icon={LanguagesIcon} label={headings.language.title} value={APP_LANGUAGE_NAMES[language]} onPress={openLanguage} />
				<ListRow icon={LockKeyholeIcon} label={headings.appLock.title} value={appLockEnabled ? labels.on : labels.off} onPress={openAppLock} />
			</ListGroup>
			<ListGroup title={sections.account}>
				<ListRow icon={ShieldCheckIcon} label={headings.security.title} description={labels.securityDescription} onPress={openSecurity} />
				<ListRow icon={SmartphoneIcon} label={headings.devices.title} onPress={openDevices} />
			</ListGroup>
			<ListGroup title={sections.rewards}>
				<ListRow icon={ScanQrCodeIcon} label={headings.till.title} description={labels.tillDescription} onPress={openTill} />
			</ListGroup>
			<ListGroup title={sections.documents}>
				<ListRow icon={FileTextIcon} label={headings.pdfViewer.title} description={labels.pdfViewerDescription} onPress={openPdfViewer} />
			</ListGroup>
			<ListGroup title={labels.about}>
				<View className="py-3">
					<DetailList items={about} />
				</View>
			</ListGroup>
			<View className="gap-3">
				{canReplayOnboarding(env) ? (
					<Button label={labels.replayOnboarding} variant="secondary" onPress={replayOnboarding} accessibilityHint={labels.replayOnboardingHint} />
				) : null}
				<Button label={labels.signOut} onPress={signOut.ask} />
			</View>
			<SignOutDialog confirmation={signOut} />
		</Screen>
	);
}
