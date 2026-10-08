"use client";

import { runThemeTransition, themeTransitionOrigin } from "@workspace/ui/lib/core/theme-transition";
import { useTheme } from "next-themes";
import * as React from "react";
import { flushSync } from "react-dom";

/** The shell's theme toggle — where a hotkey or palette switch starts its reveal from, when it is on screen. */
const SHELL_THEME_TOGGLE_SELECTOR = '[data-slot="shell-theme-toggle"]';

export interface ThemeToggle {
	/** The theme on screen (`undefined` until the browser has resolved it). */
	readonly resolvedTheme: string | undefined;
	/**
	 * Flips light ↔ dark with the circular reveal. It grows from `origin` (the control the
	 * person used); without one, from the shell's theme toggle, or the top-right corner.
	 */
	readonly toggleTheme: (origin?: Element | null) => void;
}

/**
 * The one way the apps switch light ↔ dark: the shell toggle, the `D` hotkey and every
 * command palette call this, so all of them animate the same way. The theme itself stays
 * owned by `next-themes` (rules/07).
 */
export function useThemeToggle(): ThemeToggle {
	const { resolvedTheme, setTheme } = useTheme();

	const toggleTheme = React.useCallback(
		(origin?: Element | null): void => {
			const next = resolvedTheme === "dark" ? "light" : "dark";
			const from = origin ?? document.querySelector(SHELL_THEME_TOGGLE_SELECTOR);
			// `flushSync` commits the theme (and next-themes' class effect) before the browser
			// takes the "new" snapshot, so the reveal shows the new theme, not the old one.
			runThemeTransition((): void => {
				flushSync((): void => {
					setTheme(next);
				});
			}, themeTransitionOrigin(from));
		},
		[resolvedTheme, setTheme],
	);

	return { resolvedTheme, toggleTheme };
}
