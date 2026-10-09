// ============================================
// Update required (§10.13, ADR 033)
// ============================================
// Shown on any 426 from any state; it cannot be dismissed or navigated away
// from (the root guard allows no other route). "Open the store" uses the store
// URL from the configuration; without one (development) it explains how to update.

import * as React from "react";
import { Linking, Platform } from "react-native";

import { Banner } from "../components/banner";
import { Button } from "../components/button";
import { Screen } from "../components/screen";
import { BodyText, MutedText } from "../components/text";
import { useMinimumVersion } from "../features/session/facade";
import { useReadyRuntime } from "../runtime/runtime-context";

export default function UpdateRequiredScreen(): React.JSX.Element {
	const { env, appVersion } = useReadyRuntime();
	const minimumVersion = useMinimumVersion();
	const storeUrl = Platform.select({ ios: env.iosStoreUrl, android: env.androidStoreUrl, default: null });
	const [openFailed, setOpenFailed] = React.useState(false);

	const openStore = React.useCallback((): void => {
		if (storeUrl === null) {
			return;
		}
		Linking.openURL(storeUrl).catch((): void => {
			setOpenFailed(true);
		});
	}, [storeUrl]);

	return (
		<Screen title="Update required">
			<BodyText>This version of the app is no longer supported. Update to the latest version to keep using it.</BodyText>
			<MutedText>{minimumVersion === null ? `Installed version: ${appVersion}.` : `Installed version: ${appVersion}. Oldest supported version: ${minimumVersion}.`}</MutedText>
			{storeUrl === null ? (
				<MutedText>
					{env.isDevelopment
						? "Development build: raise `version` in apps/mobile/app.config.ts (or lower MOBILE_MIN_SUPPORTED_VERSION on your API) and reload."
						: "Update the app from your device's app store."}
				</MutedText>
			) : (
				<Button label="Open the store" onPress={openStore} />
			)}
			{openFailed ? <Banner tone="error" message="The store could not be opened. Update the app from your device's app store." /> : null}
		</Screen>
	);
}
