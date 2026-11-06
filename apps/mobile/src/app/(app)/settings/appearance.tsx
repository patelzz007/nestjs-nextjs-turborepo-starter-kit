// ============================================
// Appearance (§10.9) — the theme (System / Light / Dark / Nord) and the side menu's look, applied and
// saved. Choosing a theme applies
// it on the tap itself: the radio and every colour change in the same frame, then the toast says so
// (enhancement 6.7: instant, with no photo-and-fade step in between).
// ============================================

import * as React from "react";

import { Card } from "@workspace/ui-native/components/card";
import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import { Screen } from "../../../components/screen";
import { useDrawerStyle, usePreferencesCommands, useThemePreference } from "../../../features/preferences/facade";
import { useLabels } from "../../../features/language/use-app-language";
import { drawerStyleOptionsOf, PREFERENCES_LABELS, themeOptionsOf } from "../../../features/preferences/labels";
import { useToast } from "../../../features/toast/facade";
import type { DrawerStyle, ThemePreference } from "../../../lib/secure-store";

export default function AppearanceScreen(): React.JSX.Element {
	const theme = useThemePreference();
	const drawerStyle = useDrawerStyle();
	const { drawerStyleChanged, themeChanged } = usePreferencesCommands();
	const toast = useToast();
	const labels = useLabels(PREFERENCES_LABELS);
	const options = React.useMemo((): ReturnType<typeof themeOptionsOf> => themeOptionsOf(labels), [labels]);
	const changeTheme = React.useCallback(
		(next: ThemePreference): void => {
			if (next === theme) {
				return;
			}
			// Applied at once (the store applies the theme as it records it): the dot and the colours move together.
			themeChanged(next);
			toast.success(labels.messages.themeChanged(labels.themes[next]));
		},
		[labels, theme, themeChanged, toast],
	);
	const drawerStyles = React.useMemo((): ReturnType<typeof drawerStyleOptionsOf> => drawerStyleOptionsOf(labels), [labels]);
	const changeDrawerStyle = React.useCallback(
		(next: DrawerStyle): void => {
			if (next === drawerStyle) {
				return;
			}
			drawerStyleChanged(next);
			toast.success(labels.messages.drawerStyleChanged(labels.drawerStyles[next]));
		},
		[drawerStyle, drawerStyleChanged, labels, toast],
	);
	return (
		<Screen description={labels.appearance.description}>
			<Card>
				<RadioGroup label={labels.appearance.theme} options={options} value={theme} onChange={changeTheme} />
			</Card>
			<Card>
				<RadioGroup label={labels.appearance.drawerStyle} options={drawerStyles} value={drawerStyle} onChange={changeDrawerStyle} />
			</Card>
		</Screen>
	);
}
