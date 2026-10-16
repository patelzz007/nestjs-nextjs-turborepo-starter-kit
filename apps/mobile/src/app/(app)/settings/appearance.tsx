// ============================================
// Appearance (§10.9) — System / Light / Dark, applied at once and saved
// ============================================

import * as React from "react";

import { Card } from "@workspace/ui-native/components/card";
import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import { Screen } from "../../../components/screen";
import { usePreferencesCommands, useThemePreference } from "../../../features/preferences/facade";
import { PREFERENCE_MESSAGES, THEME_OPTIONS } from "../../../features/preferences/labels";
import { useToast } from "../../../features/toast/facade";
import type { ThemePreference } from "../../../lib/secure-store";

export default function AppearanceScreen(): React.JSX.Element {
	const theme = useThemePreference();
	const { themeChanged } = usePreferencesCommands();
	const toast = useToast();
	const changeTheme = React.useCallback(
		(next: ThemePreference): void => {
			if (next === theme) {
				return;
			}
			themeChanged(next);
			toast.success(PREFERENCE_MESSAGES.themeChanged(next));
		},
		[theme, themeChanged, toast],
	);
	return (
		<Screen description="Choose how the app looks on this device.">
			<Card>
				<RadioGroup label="Theme" options={THEME_OPTIONS} value={theme} onChange={changeTheme} />
			</Card>
		</Screen>
	);
}
