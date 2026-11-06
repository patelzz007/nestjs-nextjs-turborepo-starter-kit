// ============================================
// theme-names.ts — the themes, as plain data for the apps
// ============================================
// The pickers (web theme menu, docs toggle, mobile Appearance) and the code
// that styles platform chrome by theme (the web `dark:` variant, the mobile
// status bar and native controls) read these lists, never their own copies.

import type { MobileOnlyThemeName, ThemeName } from "./schema";

/** Every theme, in the order a picker lists them (the schema's order — `theme-names.test.ts` keeps them equal). */
export const THEME_NAMES: readonly ThemeName[] = ["light", "dark", "nord"];

/**
 * The themes whose surfaces are dark. The web's `dark:` variant applies under each (`.dark`, `.nord`), and
 * each platform draws its own chrome dark for them (scrollbars, native controls, the status bar).
 */
export const DARK_THEME_NAMES: readonly ThemeName[] = ["dark", "nord"];

/** The phone's own themes, all dark, in the order its picker lists them after the shared ones. */
export const MOBILE_ONLY_THEME_NAMES: readonly MobileOnlyThemeName[] = ["current-dark", "harbour", "mocha"];

/** Whether `theme` (a theme name, or anything a store returned) is one of {@link DARK_THEME_NAMES} or {@link MOBILE_ONLY_THEME_NAMES}. */
export function isDarkTheme(theme: string | undefined): boolean {
	return [...DARK_THEME_NAMES, ...MOBILE_ONLY_THEME_NAMES].some((name) => name === theme);
}

/** The theme after `current` in {@link THEME_NAMES}, wrapping around; `dark` when `current` is not a theme (not resolved yet). */
export function nextThemeName(current: string | undefined): ThemeName {
	const index = THEME_NAMES.findIndex((name) => name === current);
	if (index === -1) {
		return "dark";
	}
	return THEME_NAMES.at((index + 1) % THEME_NAMES.length) ?? "dark";
}
