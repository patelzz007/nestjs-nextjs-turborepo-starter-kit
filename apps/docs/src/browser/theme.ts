/**
 * Light / dark theme. The docs offer two of the token themes (packages/tokens THEME_NAMES): the apps' Nord
 * has no docs palette. The theme is a class on `<html>` (`.dark`; none for light), the contract
 * `@workspace/ui` and the generated token CSS use, so every shared component the docs render follows it.
 * The toggle switches between the two with the reveal the apps use (`@workspace/ui/lib/core/theme-transition`);
 * until the reader picks one, the site follows the OS. {@link THEME_BOOTSTRAP_SCRIPT} applies the stored
 * choices before first paint.
 */
import type { ThemeName } from "@workspace/tokens";
import { runThemeTransition, themeTransitionOrigin } from "@workspace/ui/lib/core/theme-transition";

import { CODE_THEME_STORAGE_KEY } from "./code-theme";

export const THEME_STORAGE_KEY = "docs:theme";
/** Fired on `document` after the theme changes. */
export const THEME_CHANGE_EVENT = "docs:theme-change";

export type Theme = Extract<ThemeName, "light" | "dark">;

/** The docs' themes, in toggle order. A stored value outside them (an old "nord") counts as no choice. */
export const DOCS_THEMES: readonly Theme[] = ["light", "dark"];

/** The themes that are a class on `<html>` (light is the absence of one). */
const THEME_CLASSES: readonly Theme[] = DOCS_THEMES.filter((name) => name !== "light");

/** `value` as a theme, or `null` when it is not one. */
export function toTheme(value: string | null | undefined): Theme | null {
	return DOCS_THEMES.find((name) => name === value) ?? null;
}

export function currentTheme(root: HTMLElement = document.documentElement): Theme {
	return THEME_CLASSES.find((name) => root.classList.contains(name)) ?? "light";
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
	for (const name of THEME_CLASSES) {
		root.classList.toggle(name, name === theme);
	}
	document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

export function storedTheme(): Theme | null {
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

/** Switches to the other theme, remembers it, and reveals it from `origin` (the toggle button). Returns the new theme. */
export function cycleTheme(origin: Element): Theme {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	storeTheme(next);
	runThemeTransition((): void => {
		applyTheme(next);
	}, themeTransitionOrigin(origin));
	return next;
}

/** Follows the OS light / dark setting while the reader has not chosen a theme. Returns the unsubscribe. */
export function followSystemTheme(): () => void {
	const media = window.matchMedia("(prefers-color-scheme: dark)");
	const onChange = (event: MediaQueryListEvent): void => {
		if (storedTheme() === null) {
			applyTheme(event.matches ? "dark" : "light");
		}
	};
	media.addEventListener("change", onChange);
	return (): void => {
		media.removeEventListener("change", onChange);
	};
}

/**
 * Inline `<head>` script: applies the stored (or OS) theme and the code blocks' own theme before first
 * paint, so a dark reader never sees a light flash. Built from this module's keys and theme names, so the
 * two can never disagree. It also marks `<html data-js>`, which lets CSS show loading skeletons (an
 * unrendered diagram) that would never resolve without scripts.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var d=document.documentElement,t="light";try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});t=${JSON.stringify(DOCS_THEMES)}.indexOf(s)>=0?s:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}if(t!=="light")d.classList.add(t);try{var c=localStorage.getItem(${JSON.stringify(CODE_THEME_STORAGE_KEY)});if(c==="light"||c==="dark")d.dataset.codeTheme=c}catch(e){}d.dataset.js="true"})();`;
