/**
 * The code blocks' own light / dark theme, independent of the site's. A reader
 * can keep dark code in a light page (or the reverse) with the toggle in any
 * code block's header; it cycles "match the site" → light → dark and applies
 * to every block. The choice is `data-code-theme` on `<html>` (absent = match
 * the site), applied before first paint by the inline bootstrap in
 * `BaseLayout.astro` (same storage key) — global.css re-declares the theme
 * tokens inside `.code-block-island` and the `dark:` variant follows it there.
 *
 * The toggle is server-rendered into each block (src/lib/code-block/code-theme-toggle.ts)
 * and handled here by one delegated listener, so it works before and after the
 * block hydrates, and the button's label is picked by CSS from the attribute
 * (no React state, so hydration never mismatches the stored choice).
 */

export const CODE_THEME_STORAGE_KEY = "docs:code-theme";

/** The class that marks a code-theme toggle button. */
export const CODE_THEME_TOGGLE_CLASS = "code-theme-toggle";

export type CodeTheme = "site" | "light" | "dark";

/** What a click switches to. */
const NEXT_CODE_THEME: Readonly<Record<CodeTheme, CodeTheme>> = { site: "light", light: "dark", dark: "site" };

export function nextCodeTheme(theme: CodeTheme): CodeTheme {
	return NEXT_CODE_THEME[theme];
}

export function currentCodeTheme(): CodeTheme {
	const value = document.documentElement.dataset.codeTheme;
	return value === "light" || value === "dark" ? value : "site";
}

export function applyCodeTheme(theme: CodeTheme): void {
	if (theme === "site") {
		delete document.documentElement.dataset.codeTheme;
	} else {
		document.documentElement.dataset.codeTheme = theme;
	}
}

function storeCodeTheme(theme: CodeTheme): void {
	try {
		if (theme === "site") {
			window.localStorage.removeItem(CODE_THEME_STORAGE_KEY);
		} else {
			window.localStorage.setItem(CODE_THEME_STORAGE_KEY, theme);
		}
	} catch {
		// Storage can be unavailable (private mode); the choice then lasts for this page only.
	}
}

export function initCodeTheme(): void {
	document.addEventListener("click", (event: MouseEvent): void => {
		if (!(event.target instanceof Element) || event.target.closest(`.${CODE_THEME_TOGGLE_CLASS}`) === null) {
			return;
		}
		const next = nextCodeTheme(currentCodeTheme());
		storeCodeTheme(next);
		applyCodeTheme(next);
	});
}
