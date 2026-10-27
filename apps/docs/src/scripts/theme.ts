/**
 * Light / dark / Nord theme (the token themes, packages/tokens THEME_NAMES). The toggle moves to the
 * next one: light → dark → Nord → light. The initial theme is applied before first paint by the
 * inline bootstrap in `BaseLayout.astro` (same storage key); this module only
 * handles the toggle and follows the OS setting until the reader picks one.
 * A toggle click animates the switch as a reveal growing from the button — the
 * same one the apps use (`@workspace/ui/lib/core/theme-transition`).
 */
import { nextThemeName, THEME_NAMES, type ThemeName } from "@workspace/tokens";
import { runThemeTransition, themeTransitionOrigin } from "@workspace/ui/lib/core/theme-transition";

export const THEME_STORAGE_KEY = "docs:theme";
/** Fired on `document` after the theme changes (mermaid diagrams re-render on it). */
export const THEME_CHANGE_EVENT = "docs:theme-change";

export type Theme = ThemeName;

/** `value` as a theme, or `null` when it is not one. */
function toTheme(value: string | null | undefined): Theme | null {
	return THEME_NAMES.find((name) => name === value) ?? null;
}

export function currentTheme(): Theme {
	return toTheme(document.documentElement.dataset.theme) ?? "light";
}

export function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = theme;
	document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

function storedTheme(): Theme | null {
	try {
		return toTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return null;
	}
}

function storeTheme(theme: Theme): void {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Storage can be unavailable (private mode); the choice then lasts for this page only.
	}
}

export function initTheme(): void {
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
		button.addEventListener("click", () => {
			const next: Theme = nextThemeName(currentTheme());
			storeTheme(next);
			runThemeTransition((): void => {
				applyTheme(next);
			}, themeTransitionOrigin(button));
		});
	}
	const media = window.matchMedia("(prefers-color-scheme: dark)");
	media.addEventListener("change", (event) => {
		if (storedTheme() === null) {
			applyTheme(event.matches ? "dark" : "light");
		}
	});
}
