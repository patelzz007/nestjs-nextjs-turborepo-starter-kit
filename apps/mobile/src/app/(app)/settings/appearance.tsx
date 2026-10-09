// ============================================
// Appearance (§10.9) — System / Light / Dark, applied at once and saved
// ============================================

import * as React from "react";

import { Card } from "../../../components/card";
import { RadioGroup } from "../../../components/radio-group";
import { Screen } from "../../../components/screen";
import { usePreferencesCommands, useThemePreference } from "../../../features/preferences/facade";
import { THEME_OPTIONS } from "../../../features/preferences/labels";

export default function AppearanceScreen(): React.JSX.Element {
	const theme = useThemePreference();
	const { themeChanged } = usePreferencesCommands();
	return (
		<Screen title="Appearance" description="Choose how the app looks on this device.">
			<Card>
				<RadioGroup label="Theme" options={THEME_OPTIONS} value={theme} onChange={themeChanged} />
			</Card>
		</Screen>
	);
}
