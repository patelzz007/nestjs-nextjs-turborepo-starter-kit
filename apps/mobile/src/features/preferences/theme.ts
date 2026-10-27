// Applies the appearance preference through Uniwind (ADR 032): `system`
// follows the OS (and its changes), `light` / `dark` / `nord` force one theme.

import { isDarkTheme } from "@workspace/tokens";
import { Appearance } from "react-native";
import { Uniwind } from "uniwind";

import type { ThemePreference } from "../../lib/secure-store";

/** The preferences Uniwind maps onto the OS colour scheme itself. */
const ADAPTIVE_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function applyThemePreference(theme: ThemePreference): void {
	Uniwind.setTheme(theme);
	// For a theme of its own (Nord) Uniwind leaves the OS colour scheme on the system setting, so native
	// controls (keyboard, alerts, the status bar's `auto` style) would follow the OS, not the app. Pin them
	// to the theme's own lightness.
	if (!ADAPTIVE_PREFERENCES.includes(theme)) {
		Appearance.setColorScheme(isDarkTheme(theme) ? "dark" : "light");
	}
}
