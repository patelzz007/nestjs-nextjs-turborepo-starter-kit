/**
 * Light / dark theme. The initial theme is applied before first paint by the
 * inline bootstrap in `BaseLayout.astro` (same storage key); this module only
 * handles the toggle and follows the OS setting until the reader picks one.
 * A toggle click animates the switch as a reveal growing from the button — the
 * same one the apps use (`@workspace/ui/lib/core/theme-transition`).
 */
import { runThemeTransition, themeTransitionOrigin } from "@workspace/ui/lib/core/theme-transition";

export const THEME_STORAGE_KEY = "docs:theme";
/** Fired on `document` after the theme changes (mermaid diagrams re-render on it). */
export const THEME_CHANGE_EVENT = "docs:theme-change";

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = theme;
	document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

function storedTheme(): Theme | null {
	try {
		const value = window.localStorage.getItem(THEME_STORAGE_KEY);
		return value === "light" || value === "dark" ? value : null;
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
			const next: Theme = currentTheme() === "dark" ? "light" : "dark";
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
