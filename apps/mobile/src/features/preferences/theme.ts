// Applies the appearance preference through Uniwind (ADR 032): `system`
// follows the OS (and its changes), `light` / `dark` force one theme.

import { Uniwind } from "uniwind";

import type { ThemePreference } from "../../lib/secure-store";

export function applyThemePreference(theme: ThemePreference): void {
	Uniwind.setTheme(theme);
}
